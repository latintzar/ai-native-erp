/* F0 · The day's picking.
 *
 * THE ARTIFACT THAT WORKS ON DAY ONE. Brief §3 says Rocoto produces two things; this is the first,
 * and it is the only one that needs no connection, no price list, no stock records and no
 * cooperation from any vendor. Groups A–K draw the order, the lotes, what left and the albarán —
 * and skip the sheet that stands between the desk and the warehouse (C-10, FLOWS §6.1). It is
 * step 6 of thread one and nobody had drawn it.
 *
 * THE UNASKED DIMENSION, DRAWN AS A DECISION SURFACE. How the sheet is grouped — by customer (pack
 * a box at a time), by product (one trip to the cold room per SKU), or by route (in drop order) —
 * is a question no dimension in the brief asks, and every real warehouse has an opinion. The
 * resolution is to refuse a default: the grouping is a LIVE segmented control, the same rows
 * re-sort in front of the founder, and the three sheets are visible beside each other in the time
 * it takes to press three buttons. SECTORS §7's cold-zone question is the same question one step
 * further on, so it stands on the same control as a fourth, ghosted position.
 *
 * THE COLUMN SET NEVER MOVES. That is `el papel`'s law and it is what makes H1 a data delta on
 * this card rather than a second layout: the grouping changes the headings between the rows and
 * the order of the rows, and the three columns stay exactly where they are.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import { Button, KIND, SIZE } from 'baseui/button';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import PrintSheet, { SheetMasthead, SheetFoot } from '../canonical/print-sheet';
import { GRegion } from '../ghosts/regions';
import RefChip from '../shell/RefChip';
import Name from '../shell/Name';
import { useSector } from '../shell/context';
import type { Cast, Customer, Product } from '../data/cast';
import { customerOf, lineFacts, productOf } from '../data/cast';
import type { PaperColumn, PaperRow } from '../../rocoto/paper';

export const meta: ScenarioMeta = {
  id: 'F0',
  title: "The day's picking",
  group: 'F',
  frame: 'desk',
  paper: true,
  ifText: 'any configuration — the sheet is produced for every company, on the first day',
  dims: [],
  job: "Put in one picker's hands everything that has to leave today.",
  decides:
    'what a picker carries into the warehouse — and how the sheet is grouped, asked as a control rather than answered as a default',
  inherits: [
    { region: "the day's confirmed lines", ref: 'A1' },
    { region: 'the lote each line comes out of', ref: 'E1' },
    { region: 'the boundary where a line spans two lotes', ref: 'E2' },
    { region: "where the sheet's rows go next", ref: 'F1' },
    { region: "the customer's own words riding a line", ref: 'A10' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'the cold-zone grouping', ref: 'OPEN-13' },
    { region: 'who put the stops in that order', ref: 'OPEN-17' },
  ],
  primitives: [],
  kit: ['Paper', 'Paper Stage', 'Segmented Control', 'Button', 'Ghost'],
  canonical: 'print-sheet',
  delta: 'origin',
  deltaText: 'the card that IS the print sheet; H1 is the same sheet with the albarán in it',
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fruit',
  thread: [1],
  step: 6,
  fills: [],
  reads: ['order', 'lot', 'line.note'],
  live:
    'press by customer, by product or by route and the same rows re-sort under headings that change while the three columns stay where they are; the fourth position stands ghosted and says what would settle it',
};

/* ── THE DAY, DERIVED ─────────────────────────────────────────────────────────────────────────
 * Law 10: no name is typed into a screen. The day is built from the cast — the order the whole
 * catalogue is drawn against, plus what the other four customers take from the same catalogue —
 * so the sheet is dense the way a real morning is dense and every word on it came from one file.
 */

/* EXPORTED FOR THE APP. Dispatch's picking sheet IS this sheet — same day, same groupings, same
 * column set — so the two cannot drift. Nothing below changed to make that true; the `export`
 * keyword is the whole edit. */
export type Pick = {
  id: string;
  customer: Customer;
  product: Product;
  qty: number;
  unit: string;
  lot?: string;
  /** the customer's own words, surviving onto the row (A10 → F0) */
  note?: string;
  /** which round the customer's stop is on, and where in it */
  round: number;
  stop: number;
};

/** The words the customer wrote about a product, where they wrote any. Matched rather than typed:
 *  «El aguacate bien maduro» belongs to the Aguacate row and to no other. */
const noteFor = (cast: Cast, product: Product): string | undefined => {
  const head = product.name.split(' ')[0].toLowerCase();
  return cast.order.words.slice(1).find((w) => w.toLowerCase().includes(head));
};

const round = (i: number) => (i % 2) + 1;
const stop = (i: number) => Math.floor(i / 2) + 1;

export const day = (cast: Cast): Pick[] => {
  const ordered = customerOf(cast, cast.order.customer);
  const ci = cast.customers.findIndex((c) => c.id === ordered.id);

  /* the order the catalogue is drawn against, exactly as A1 confirmed it */
  const its: Pick[] = cast.order.lines.map((line) => {
    const product = productOf(cast, line.product);
    return {
      id: `${ordered.id}-${line.id}`,
      customer: ordered,
      product,
      qty: line.qty,
      unit: line.unit,
      lot: line.lot,
      note: noteFor(cast, product),
      round: round(ci),
      stop: stop(ci),
    };
  });

  /* the rest of the day, from the same catalogue */
  const rest: Pick[] = cast.customers.flatMap((customer, c) => {
    if (customer.id === ordered.id) return [];
    return cast.products
      .filter((_, p) => (c + p) % 3 !== 2)
      .map((product, k) => {
        const packed = !!product.pack;
        const qty = 1 + ((c * 4 + k * 3) % 7) * (packed ? 1 : 2);
        return {
          id: `${customer.id}-${product.id}`,
          customer,
          product,
          qty,
          unit: packed ? (product.pack as { unit: string }).unit : product.unit,
          lot: product.trace.lote,
          round: round(c),
          stop: stop(c),
        };
      });
  });

  return [...its, ...rest];
};

/* ── THE THREE GROUPINGS ──────────────────────────────────────────────────────────────────────
 * The whole question, as three functions. Same rows, three orders, three sets of headings, one
 * column set — which is exactly what makes it a question a founder can answer by looking. */

export type Grouping = 'customer' | 'product' | 'route';

export const GROUPINGS: Array<{ key: Grouping; label: string; description: string }> = [
  { key: 'customer', label: 'By customer', description: 'pack one box at a time' },
  { key: 'product', label: 'By product', description: 'one trip per product' },
  { key: 'route', label: 'By route', description: 'in drop order' },
];

export const keyOf = (grouping: Grouping, pick: Pick): string => {
  if (grouping === 'customer') return pick.customer.name;
  if (grouping === 'product') return pick.product.name;
  return `Round ${pick.round}`;
};

export const sortOf = (grouping: Grouping, cast: Cast) => (a: Pick, b: Pick): number => {
  const ci = (p: Pick) => cast.customers.findIndex((c) => c.id === p.customer.id);
  const pi = (p: Pick) => cast.products.findIndex((x) => x.id === p.product.id);
  if (grouping === 'customer') return ci(a) - ci(b) || pi(a) - pi(b);
  if (grouping === 'product') return pi(a) - pi(b) || ci(a) - ci(b);
  return a.round - b.round || a.stop - b.stop || pi(a) - pi(b);
};

export const COLUMNS: PaperColumn[] = [
  { key: 'item', label: 'Item', width: 'minmax(0, 1fr)' },
  { key: 'for', label: 'For', width: '150px' },
  { key: 'qty', label: 'Qty', width: '96px', align: 'end' },
];

export default function F0() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [grouping, setGrouping] = React.useState<Grouping>('customer');

  const picks = React.useMemo(() => day(cast), [cast]);

  /* the rows the sheet prints: a heading wherever the group changes, then its picks */
  const rows: PaperRow[] = React.useMemo(() => {
    const sorted = [...picks].sort(sortOf(grouping, cast));
    const out: PaperRow[] = [];
    let held = '';
    for (const pick of sorted) {
      const group = keyOf(grouping, pick);
      if (group !== held) {
        held = group;
        out.push({ id: `h-${group}`, cells: { item: <Heading>{group}</Heading>, for: '', qty: '' } });
      }
      const facts = lineFacts(cast, pick.product);
      out.push({
        id: pick.id,
        cells: {
          item: <Name of={pick.product} />,
          qty: `${pick.qty} ${pick.unit}`,
          for: (
            <>
              {pick.stop}. <Name of={pick.customer} />
            </>
          ),
        },
        sub: [
          ...(pick.lot ? [{ label: 'lote', value: pick.lot }] : []),
          ...facts,
        ],
        note: pick.note ? <em>&ldquo;{pick.note}&rdquo;</em> : undefined,
      });
    }
    return out;
  }, [picks, grouping, cast]);

  const lines = picks.length;
  const stops = new Set(picks.map((p) => p.customer.id)).size;

  return (
    <DeskChassis selected={-1} rows={11} daylist={{ label: "the day's orders" }} height={880}>
      <PrintSheet
        heading="The day's picking"
        standfirst={
          <>
            Everything that has to leave today, in one picker&rsquo;s hands. The same sheet stands on a
            phone in the cold room.
          </>
        }
        controls={
          <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale300, minWidth: 0 }}>
            {/* THE THREE ARE WRITTEN OUT, not mapped. Base keys a Segment by `child.key` and falls
                back to the child's INDEX, and React prefixes an array key with `.$` — so a mapped
                list hands `onChange` «.$customer» where the control is comparing indices, and the
                strip silently stops selecting. Three explicit children keep Base's own contract. */}
            <SegmentedControl
              activeKey={GROUPINGS.findIndex((g) => g.key === grouping)}
              onChange={({ activeKey }) => setGrouping(GROUPINGS[Number(activeKey)].key)}
            >
              <Segment label={GROUPINGS[0].label} description={GROUPINGS[0].description} />
              <Segment label={GROUPINGS[1].label} description={GROUPINGS[1].description} />
              <Segment label={GROUPINGS[2].label} description={GROUPINGS[2].description} />
            </SegmentedControl>
            {/* THE FOURTH POSITION. Fruit is the only sector whose load is not one temperature, so
                a per-SKU zone tag and a walk of the cold room in zone order is a real fourth
                grouping — and nobody has asked for it. It stands on the control where it belongs,
                ghosted, carrying the question that would settle it. */}
            <div style={{ width: 208 }}>
              <GRegion
                open={13}
                shape="pill"
                width="100%"
                height={theme.sizing.scale1400}
                label="by cold zone"
              />
            </div>
          </div>
        }
        aside={
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap' }}>
            {lines} lines · {stops} stops
          </span>
        }
        columns={COLUMNS}
        rows={rows}
        masthead={
          /* NO ISSUER. A picking list never leaves the building, so the house's own name would be
             a line of ink nobody reads; the left block carries the round the picker is walking.
             (The account's own name is also the one name `cast.ts` does not hold — the cast names
             who the house buys from and who it sells to, and the house itself is the user.) */
          <SheetMasthead
            document="Picking list"
            recipient={`Warehouse · grouped ${GROUPINGS.find((g) => g.key === grouping)?.label.toLowerCase()}`}
            day={cast.order.deliveryDay}
            serial={`from ${cast.hour}`}
          />
        }
        runningHead={
          <>
            Picking list · {cast.order.deliveryDay} · grouped{' '}
            {GROUPINGS.find((g) => g.key === grouping)?.label.toLowerCase()}
          </>
        }
        foot={
          <SheetFoot
            totals={
              <>
                {lines} lines across {stops} stops. Every weighed line comes back on{' '}
                <RefChip to="F1">the dispatch screen</RefChip>.
              </>
            }
          />
        }
        stageWidth={560}
        height={620}
        action={
          <div style={{ display: 'flex', gap: theme.sizing.scale400, alignItems: 'center', flexWrap: 'wrap' }}>
            <Button kind={KIND.primary} size={SIZE.compact}>Print</Button>
            <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              The grouping the founder picks becomes this account&rsquo;s sheet.
            </span>
          </div>
        }
      />
    </DeskChassis>
  );
}

/** A group heading, printed between the rows it gathers. It rides the first column, so the three
 *  columns hold their positions under every grouping — which is the card's argument. */
export function Heading({ children }: { children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelSmall,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
      }}
    >
      {children}
    </span>
  );
}
