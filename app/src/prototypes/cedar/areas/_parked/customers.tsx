import { solesRate } from '../../currency';
/* PARKED (THE-APP-V2 §1): a customer is reachable from a sale, so the relationship has no tab of its own. Out of the area glob; the file stays readable and still typechecks. */
/* CUSTOMERS — group J, the relationship surface.
 *
 * THE RECORD IS READ DURING A MORNING, NOT BROWSED. That is `customer-page`'s own argument and the
 * reason its eight blocks stand in the order they stand in: identity names the page, then the
 * blocks a question mid-order lands on — what they take, what they pay, what they may order — then
 * the blocks set once, then the log. The app changes exactly one thing about that page: every
 * block has an owner here, so every block is open. A pointer at a catalogue card would be a
 * pointer at a page this app does not have.
 *
 * WHAT THE PUZZLE ASSEMBLES:
 *   · `customer-page` (J1a) — the architecture, unchanged, with its blocks filled.
 *   · `memory-log` — the whole chronology of how a thing that was asked for became a thing that is
 *     known. THE MACHINE'S GUESS IS SAFFRON AND A SETTLED FACT IS INK, and the outcome row holds an
 *     EMPTY SLOT until a person settles it — the empty-slot law, which is what keeps an invention
 *     out of a record that is about to be trusted.
 *   · `price-accordion` — the tier this customer sits on, opened at the level the setup answered.
 *   · `agreement`'s own parts — the general rule beside the exception, and the gap between them
 *     drawn rather than left to arithmetic in somebody's head.
 *   · `public-doc` inside the `public` chassis — «what Can Solé sees». Not a mockup of the page:
 *     the page, in the frame a stranger opens it in.
 *
 * WHY THE PUBLIC PAGE IS ON THIS SURFACE AT ALL (LOT-LAW §10). What we print is what the customer
 * shows their own inspector — legally so for meat, functionally so for HORECA fish. An albarán that
 * doubles as the buyer's register is a reason to switch supplier, so the trazabilidad block is a
 * SALES surface, and the person who sells to this customer should be able to see it from the
 * customer's own page.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SHAPE, SIZE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { ProgressBar } from 'baseui/progress-bar';
import { Figure } from '../../figure';
import { GhostBlock } from '../../../../rocoto/ghost';
import { MemoryLog, type MemoryEvent } from '../../../../rocoto/memory-log';
import { PriceAccordion, PriceInput, type PriceModel } from '../../../../rocoto/price-accordion';
import { Gap, Settled } from '../../../../scenarios/canonical/agreement';
import CustomerPage, { type CustomerBlock } from '../../../../scenarios/canonical/customer-page';
import PublicDoc from '../../../../scenarios/canonical/public-doc';
import PublicChassis from '../../../../scenarios/chassis/public';
import { buildAlbaran, todaysAlbaranes } from '../../../../scenarios/canonical/release';
import { buildRound } from '../../../../scenarios/canonical/drop-list';
import Name from '../../../../scenarios/shell/Name';
import { productOf, type Cast, type Customer, type Product } from '../../../../scenarios/data/cast';
import { useConfig, type Derived } from '../../config';
import { Derivation } from '../../anchors';
import Page from '../../shell/page';
import type { AreaMeta } from '../../shell/area';

export const meta: AreaMeta = {
  id: 'customers',
  title: 'Customers',
  owner: 'APP-C',
};

const LOCALE = 'es-ES';
const round2 = (n: number) => Math.round(n * 100) / 100;

const card = (theme: ReturnType<typeof useStyletron>[1]): React.CSSProperties => ({
  border: `1px solid ${theme.colors.borderOpaque}`,
  borderRadius: theme.borders.radius300,
  background: theme.colors.backgroundPrimary,
  padding: theme.sizing.scale600,
  minWidth: 0,
});

/* ── THE WORDS AN ORDER ARRIVES IN ────────────────────────────────────────────────────────────
 * A customer writes «gamba roja», and the catalogue holds «Gamba roja de Palamós». That gap is
 * layer 2 of the what-is-sold fractal, and it is why memory exists at all. The short form is READ
 * OFF the catalogue name rather than typed, so a cast with different products produces different
 * words with no edit here. */

const STOPWORDS = new Set(['de', 'del', 'la', 'el', 'al', 'con']);

export const shortForm = (product: Product): string => {
  const words = product.name.split(' ');
  const out = [words[0]];
  if (words[0].length < 6 && words[1] && !STOPWORDS.has(words[1].toLowerCase())) out.push(words[1]);
  return out.join(' ').toLowerCase();
};

/* ── THE CHAIN ────────────────────────────────────────────────────────────────────────────────
 * The founder's own chronology, in his order: receipt → clarification → matching → best candidates
 * → confirmation by a person → the match landing → saved in memory forever. Steps 5 and 6 are one
 * event, because a person confirming IS the match landing on the right one. */

const STRENGTHS = [0.86, 0.57, 0.31];

type Chain = {
  subject: Product;
  asked: string;
  events: MemoryEvent[];
  candidates: Product[];
};

function chainOf(cast: Cast, customer: Customer, index: number, settled: boolean): Chain {
  const subject = cast.products[(index + 1) % cast.products.length];
  const asked = shortForm(subject);
  const family = subject.family;

  /* the shortlist: the subject first, then its shelf-mates. The machine's own ordering, so it
     carries the machine's own mark. */
  const candidates = [
    subject,
    ...cast.products.filter((p) => p.family === family && p.id !== subject.id),
  ].slice(0, 3);

  const line = cast.order.lines[index % cast.order.lines.length];

  const events: MemoryEvent[] = [
    {
      id: 'received',
      kind: 'received',
      at: cast.order.placedAt,
      by: customer.name,
      note: `Their order arrived on ${customer.channel}, asking for ${asked}.`,
      figure: { value: line.qty, unit: line.unit, decimals: line.unit === 'kg' ? 1 : 0 },
    },
    {
      id: 'clarified',
      kind: 'clarified',
      at: '06:20',
      by: 'The desk',
      note: `Asked which ${asked} they meant, on the same thread the order came in on.`,
    },
    {
      id: 'matched',
      kind: 'matched',
      at: '06:21',
      by: 'Rocoto',
      note: 'Read the words against the catalogue.',
      match: subject.name,
    },
    {
      id: 'candidates',
      kind: 'candidates',
      at: '06:21',
      by: 'Rocoto',
      note: 'Put up the shelf it could be, strongest first.',
      candidates: candidates.map((p, i) => ({
        id: p.id,
        name: p.name,
        detail: `${p.trace.lote} · sold by the ${p.unit}`,
        strength: STRENGTHS[i],
      })),
    },
  ];

  if (settled) {
    events.push(
      {
        id: 'confirmed',
        kind: 'confirmed',
        at: '06:24',
        by: 'The desk',
        note: 'Confirmed it on the order, and the question stopped.',
        match: subject.name,
      },
      {
        id: 'settled',
        kind: 'settled',
        at: '06:24',
        by: 'Rocoto',
        match: subject.name,
        figure: { value: line.qty, unit: line.unit, decimals: line.unit === 'kg' ? 1 : 0 },
      },
    );
  }

  return { subject, asked, events, candidates };
}

/* ── THE PRICE STRUCTURE ──────────────────────────────────────────────────────────────────────
 * The four levels of the fractal, built from the cast, so an item's accordion opens at the level
 * the setup answered and reads the same numbers whichever level that is. */

const tierNames = (cast: Cast): string[] =>
  cast.customers.map((c) => c.tier).filter((t, i, a) => a.indexOf(t) === i).sort();

const TIER_STEP = [0, 0.06, 0.12];

/** What the general rule gives this item, once — AND HOW IT GOT THERE. The tier row, the accordion
 *  and the gap all read it, so the customer page cannot state two prices for one product, and the
 *  sentence under the figure is the derivation the figure actually took. */
export function basePrice(cast: Cast, product: Product): { price: number; how: string } {
  const onOrder = cast.order.lines.find((l) => l.product === product.id);
  if (onOrder) return { price: onOrder.price, how: 'The price this line was confirmed at today' };
  const batch = cast.batches.find((b) => b.product === product.id) ?? cast.batches[0];
  return { price: round2(batch.cost * 1.35), how: 'Today’s cost, carried up by the house margin' };
}

function priceModel(cast: Cast, product: Product, level: Derived['prices']['opensAt']): PriceModel {
  const base = basePrice(cast, product).price;
  const names = tierNames(cast);
  const priceAt = (i: number) => round2(base * (1 + TIER_STEP[i % TIER_STEP.length]));

  if (level === 1) return { level: 1, price: base, since: cast.order.deliveryDay };
  if (level === 2) {
    return {
      level: 2,
      tiers: names.map((name, i) => ({ id: `t${i + 1}`, name, price: priceAt(i) })),
    };
  }
  if (level === 3) {
    return {
      level: 3,
      anchor: base,
      anchorName: 'lonja',
      stops: names.map((name, i) => ({ id: `t${i + 1}`, name, offset: TIER_STEP[i % TIER_STEP.length] * 100 })),
    };
  }

  /* level 4 — every tier set by hand, every day, so the item's price over time is a log */
  const days = [
    (cast.order.deliveryDay.match(/\d{2}\.\d{2}/) ?? ['22.08'])[0],
    ...cast.batches.map((b) => b.day).filter((d, i, a) => a.indexOf(d) === i),
  ].slice(0, 4);
  return {
    level: 4,
    tiers: names.map((name, i) => ({ id: `t${i + 1}`, name })),
    days,
    log: days.flatMap((day, d) =>
      names.map((_, i) => ({
        id: `${day}-t${i + 1}`,
        day,
        tierId: `t${i + 1}`,
        price: round2(priceAt(i) * (1 - d * 0.03)),
      })),
    ),
  };
}

/* ── THE LIST ─────────────────────────────────────────────────────────────────────────────── */

function CustomerList({
  cast,
  selected,
  onSelect,
}: {
  cast: Cast;
  selected: string;
  onSelect: (id: string) => void;
}) {
  const [, theme] = useStyletron();
  const docs = todaysAlbaranes(cast);

  return (
    <div
      data-testid="customer-list"
      style={{
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius300,
        background: theme.colors.backgroundPrimary,
        overflow: 'hidden',
      }}
    >
      {cast.customers.map((customer, i) => {
        const lit = customer.id === selected;
        return (
          <button
            key={customer.id}
            type="button"
            data-customer={customer.id}
            data-selected={lit ? 'yes' : 'no'}
            onClick={() => onSelect(customer.id)}
            style={{
              display: 'grid',
              gridTemplateColumns: 'minmax(0, 1fr) auto',
              alignItems: 'center',
              gap: theme.sizing.scale400,
              width: '100%',
              textAlign: 'left',
              padding: theme.sizing.scale500,
              border: 'none',
              borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
              background: lit ? theme.colors.backgroundSecondary : theme.colors.backgroundPrimary,
              color: theme.colors.contentPrimary,
              cursor: 'pointer',
              fontFamily: 'inherit',
              boxShadow: lit ? `inset 3px 0 0 0 ${theme.colors.contentPrimary}` : 'none',
            }}
          >
            <span style={{ minWidth: 0, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100 }}>
              <span style={theme.typography.LabelMedium}>
                <Name of={customer} />
              </span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                {customer.tier} · {customer.channel} · settles {customer.settles}
              </span>
            </span>
            <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary, whiteSpace: 'nowrap' }}>
              {docs[i].number}
            </span>
          </button>
        );
      })}
    </div>
  );
}

/* ── ONE BLOCK'S BODY ─────────────────────────────────────────────────────────────────────── */

function Rows({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return <div style={{ ...card(theme), display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>{children}</div>;
}

function Fact({ label, children }: { label: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
      <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>{label}</span>
      <span style={theme.typography.LabelMedium}>{children}</span>
    </div>
  );
}

/* ── THE SURFACE ──────────────────────────────────────────────────────────────────────────── */

export default function Customers() {
  const [, theme] = useStyletron();
  const { derived } = useConfig();
  const cast = derived.cast;

  const [selected, setSelected] = React.useState(cast.customers[0].id);
  const [confirmed, setConfirmed] = React.useState<Record<string, string>>({});
  const [agreed, setAgreed] = React.useState<Record<string, number>>({});
  const [writing, setWriting] = React.useState(false);

  /* a different cast is a different catalogue and a different set of records */
  React.useEffect(() => {
    setSelected(cast.customers[0].id);
    setConfirmed({});
    setAgreed({});
    setWriting(false);
  }, [cast.sector]);

  const index = Math.max(0, cast.customers.findIndex((c) => c.id === selected));
  const customer = cast.customers[index];
  const docs = todaysAlbaranes(cast);
  const doc = docs[index];
  const stop = buildRound(cast)[index];

  /* HALF THE RECORDS ARRIVE SETTLED and half arrive open, so both states are on the surface before
     anybody touches it — and the open one is still there to be settled by hand. */
  const settledByDefault = index % 2 === 0;
  const isSettled = confirmed[customer.id] !== undefined || settledByDefault;
  const chain = chainOf(cast, customer, index, isSettled);

  const priceProduct = cast.products[index % cast.products.length];
  const model = priceModel(cast, priceProduct, derived.prices.opensAt);
  const orderLine = cast.order.lines[index % cast.order.lines.length];
  const rule = basePrice(cast, priceProduct);
  const rulePrice = rule.price;
  const agreedPrice = agreed[`${customer.id}-${priceProduct.id}`];

  const albaran = React.useMemo(
    () => ({ ...buildAlbaran(cast, { customer: customer.id, lines: doc.lines }), number: doc.number }),
    [cast, customer.id, doc.lines, doc.number],
  );

  /* THE EIGHT BLOCKS, FILLED. `customer-page` decides which exist and in what order; this decides
     what each one holds, which is the only thing the app adds to J1a. */
  const renderFull = (block: CustomerBlock): React.ReactNode => {
    switch (block.id) {
      case 'identity':
        return (
          <Rows>
            <Fact label="Their orders arrive on">{customer.channel}</Fact>
            <Fact label="They settle">{customer.settles}</Fact>
            <Fact label="Today’s drop">
              stop {index + 1} on the round · {stop.slot}
            </Fact>
            <Derivation q="capture">{derived.capture.label}, and every door reaches this record.</Derivation>
          </Rows>
        );

      case 'preferences':
        return (
          /* THE MEMORY LOG. Saffron is the machine's proposal; the instant a person confirms, the
             same name is rewritten in ink and the outcome row fills. Until then the row holds an
             empty slot, because a guess promoted into an answer reads exactly like a fact. */
          <div data-testid="memory-log">
            <MemoryLog
              key={`${customer.id}-${isSettled ? 'settled' : 'open'}`}
              asked={chain.asked}
              customer={customer.name}
              events={chain.events}
              outcomeLabel="Remembered as"
              onConfirm={
                isSettled
                  ? undefined
                  : (candidate) => setConfirmed((c) => ({ ...c, [customer.id]: candidate.id }))
              }
            />
          </div>
        );

      case 'prices':
        /* THE GENERAL RULE IS ALWAYS ON THE SCREEN. An exception is only legible next to the thing
           it is an exception to, so the gap between them is drawn and never left to arithmetic. */
        return (
          <Rows>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-end', gap: theme.sizing.scale600, flexWrap: 'wrap' }}>
              <div style={{ minWidth: 0 }}>
                <div style={theme.typography.LabelSmall}>
                  <Name of={priceProduct} /> · what {customer.tier} gives them
                </div>
                <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  {rule.how}
                </div>
                <Figure value={rulePrice} unit={`S/ per ${priceProduct.unit}`} size="default" />
              </div>
              <Gap rule={rulePrice} agreed={agreedPrice} unit={`S/ per ${priceProduct.unit}`} />
            </div>

            <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, flexWrap: 'wrap' }}>
              {writing ? (
                <span style={{ width: 160 }}>
                  <PriceInput
                    value={agreedPrice ?? rulePrice}
                    unit={`S/ per ${priceProduct.unit}`}
                    decimals={2}
                    locale={LOCALE}
                    label={`the price agreed with ${customer.name}`}
                    onCommit={(next) => {
                      setAgreed((a) => ({ ...a, [`${customer.id}-${priceProduct.id}`]: next }));
                      setWriting(false);
                    }}
                    onCancel={() => setWriting(false)}
                  />
                </span>
              ) : (
                <Button
                  kind={KIND.secondary}
                  size={SIZE.compact}
                  onClick={() => setWriting(true)}
                  data-testid="agree-price"
                >
                  {agreedPrice === undefined ? 'Fix a price for them' : 'Change their price'}
                </Button>
              )}
              {agreedPrice !== undefined && (
                <span data-testid="agreed">
                  <Settled wide>
                    Agreed at {solesRate(agreedPrice, priceProduct.unit)}
                  </Settled>
                </span>
              )}
            </div>
          </Rows>
        );

      case 'tier':
        return (
          <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
            <Derivation q="pricing">
              Their prices open at level {derived.prices.opensAt}, and an agreement moves any line off it.
            </Derivation>
            <div data-testid="tier-accordion">
              <PriceAccordion
                key={`${priceProduct.id}-${derived.prices.opensAt}`}
                name={priceProduct.name}
                note={`${customer.tier} is theirs`}
                price={model}
                unit={`S/ per ${priceProduct.unit}`}
                decimals={2}
                locale={LOCALE}
              />
            </div>
          </div>
        );

      case 'catalogue':
        return (
          <Rows>
            <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
              {cast.products.map((p) => (
                <Tag key={p.id} closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                  {p.name}
                </Tag>
              ))}
            </div>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              The whole catalogue is open to them. A line outside it goes to the desk first.
            </span>
          </Rows>
        );

      case 'volume': {
        const promised = orderLine.qty * 20;
        const taken = Math.round(promised * (0.4 + index * 0.12));
        return (
          <Rows>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500 }}>
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                <Name of={productOf(cast, orderLine.product)} /> · this quarter
              </span>
              <Figure value={taken} unit={orderLine.unit} decimals={0} size="compact" />
            </div>
            <ProgressBar
              value={Math.min(100, Math.round((taken / promised) * 100))}
              successValue={100}
              overrides={{ BarProgress: { style: { backgroundColor: theme.colors.contentPrimary } } }}
            />
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              Held at the agreed price to {promised.toLocaleString(LOCALE)} {orderLine.unit}.
            </span>
          </Rows>
        );
      }

      case 'days':
        return (
          <Rows>
            <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap' }}>
              {['Tuesday', 'Thursday', 'Friday'].slice(index % 2).map((d) => (
                <Tag key={d} closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                  {d}
                </Tag>
              ))}
            </div>
            <Derivation q="delivery">{derived.dispatch.roundsLabel}.</Derivation>
          </Rows>
        );

      case 'history':
        return (
          <div style={{ ...card(theme), padding: 0 }}>
            {[
              doc.number,
              ...cast.batches
                .map((b) => b.day)
                .filter((d, i, a) => a.indexOf(d) === i)
                .map((d) => `${d.replace('.', '')}-${110 + index}`),
            ].map((number, i) => (
              <div
                key={number}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto',
                  alignItems: 'baseline',
                  gap: theme.sizing.scale500,
                  padding: theme.sizing.scale500,
                  borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                }}
              >
                <span style={{ minWidth: 0 }}>
                  <span style={theme.typography.LabelSmall}>Delivery Note {number}</span>
                  <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, display: 'block' }}>
                    {i === 0 ? `${doc.lines} lines · released ${doc.at}` : `${4 + i * 2} lines · delivered`}
                  </span>
                </span>
                {i === 0 && <Figure value={albaran.total} unit="S/" size="compact" />}
              </div>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  return (
    <Page title="Customers">
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 300px) minmax(0, 1fr)',
          gap: theme.sizing.scale800,
          alignItems: 'start',
          minWidth: 0,
        }}
      >
        <CustomerList cast={cast} selected={selected} onSelect={setSelected} />

        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale1000, minWidth: 0 }}>
          <CustomerPage
            key={customer.id}
            cast={cast}
            customer={customer}
            full={['identity', 'preferences', 'prices', 'tier', 'catalogue', 'volume', 'days', 'history']}
            renderFull={renderFull}
          />

          {/* ── WHAT THEY SEE ────────────────────────────────────────────────────────────────
              The only Rocoto page this customer ever opens, in the frame they open it in. It is
              the same document the release gate let go; nothing here is a second drawing of it. */}
          <section data-testid="public-preview" style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale500, minWidth: 0 }}>
            <header>
              <h2 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>
                What <Name of={customer} /> sees
              </h2>
              <p style={{ margin: `${theme.sizing.scale200} 0 0`, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '70ch' }}>
                Their inspector reads this page over their shoulder, so the traceability block is a
                reason to buy from this house. It is the delivery note, in the browser they open it in.
              </p>
            </header>

            <Derivation q="lots">{derived.lots.label}.</Derivation>

            <PublicChassis
              height={620}
              bar={
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: theme.sizing.scale300,
                    padding: `${theme.sizing.scale200} ${theme.sizing.scale500}`,
                    borderRadius: theme.borders.radius400,
                    background: theme.colors.backgroundPrimary,
                    border: `1px solid ${theme.colors.borderOpaque}`,
                    ...theme.typography.ParagraphXSmall,
                    color: theme.colors.contentSecondary,
                  }}
                >
                  <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
                    Link
                  </Tag>
                  soyrocoto.com/albaran/{albaran.number}
                </div>
              }
            >
              <PublicDoc
                albaran={albaran}
                letterhead={
                  <GhostBlock shape="block" height={72} grow label="the house’s own name and tax number" />
                }
                tail={
                  <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
                    <Button kind={KIND.secondary} size={SIZE.compact} shape={SHAPE.pill}>
                      Download it
                    </Button>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                      Their own register keeps a copy, dated the day it was delivered.
                    </span>
                  </div>
                }
              />
            </PublicChassis>
          </section>
        </div>
      </div>
    </Page>
  );
}
