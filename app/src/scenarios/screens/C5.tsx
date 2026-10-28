/* C5 · Decide about orders taken at the old price.
 *
 * A DATA DELTA on A13's notice, and the reduction's own claim: the affected records here are
 * ORDERS taken at the previous price rather than downstream commitments. Same `U11`, same table,
 * same law — «Leave them as they are» first, and nothing moves on its own.
 *
 * THE ASSUMPTION THIS CARD STANDS ON (BUILD-PLAN §3.2): THE PRICE STAMPS AT CONFIRMATION. That is
 * why C5 exists at all — a house that priced at invoicing would never have this screen. The card
 * says so out loud, so a founder's «no» is one edit rather than an excavation.
 *
 * THE SECTOR DELTA CHANGES THE SCREEN'S ADDRESS, NOT THE SCREEN. In fish the cost moves between
 * the 06:00 orders and the 08:00 orders, so this is a routine morning surface and it belongs
 * inside the day. In fruit it is weekly and in meat it is rare, so there it lives behind a door.
 * One screen, two homes, and the home is derived from D7 and D8. Run the sector switch and read
 * the address line: it is the whole argument.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import ChangeNotice, { LEAVE, type NoticeRow } from '../canonical/change-notice';
import { costOf, listPrice, priceFrom } from '../canonical/margin-desk';
import { GRegion } from '../ghosts/regions';
import { productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'C5',
  title: 'Decide about orders taken at the old price',
  group: 'C',
  frame: 'desk',
  ifText: 'a price changed after orders had already been recorded at the previous one',
  dims: ['D8.list', 'D8.margin', 'D9.many'],
  job: 'Decide what happens to orders already taken at the price that just changed.',
  decides:
    'what happens to orders already stamped when the price moves — the customers, the times and the difference in euros, with «Leave them as they are» offered first and nothing moving on its own',
  inherits: [
    { region: 'the price change itself', ref: 'C3' },
    { region: 'the list it came off', ref: 'C1' },
    { region: 'the albaranes already sent', ref: 'H2' },
    { region: "today's file", ref: 'G2' },
  ],
  open: [{ region: "the day's bar and the day's orders", ref: 'OPEN-1' }],
  primitives: ['U11'],
  kit: ['Button Group', 'Tag', 'Figure', 'Ghost'],
  canonical: 'change-notice',
  delta: 'data',
  deltaText: 'the affected records are orders taken at the old price, not downstream commitments',
  sector: { fish: 'Δ', meat: 'Δ', fruit: 'Δ' },
  drawnWith: 'fish',
  thread: [2],
  step: 6,
  fills: [],
  reads: ['price', 'order'],
  live:
    'choose an outcome other than the first and every row recomputes the euros that would move under it; the sector switch moves the card’s stated address between the day’s surface and a door, which is the argument',
};

/** Where the card lives, per sector. The screen is one; the address is derived from D7 and D8. */
const ADDRESS: Record<string, { where: string; how_often: string }> = {
  fish: {
    where: 'Inside the day’s surface, beside the orders it is about',
    how_often: 'Most mornings, because the cost moves between the 06:00 orders and the 08:00 ones',
  },
  meat: {
    where: 'Behind a door, on the prices surface',
    how_often: 'A few times a year, when a contract is revised',
  },
  fruit: {
    where: 'Behind a door, on the prices surface',
    how_often: 'Weekly, when the list is rewritten',
  },
};

/** The euros an outcome moves, spelled for a reader. Each outcome's own line carries it, so the
 *  choice is legible BEFORE it is made rather than after. */
const euros = (n: number) =>
  `${n.toLocaleString('es-ES', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} €`;

/** The hour each affected order came in. Deterministic, so the table reads the same every time. */
const HOURS = ['06:04', '06:21', '06:38', '07:02', '07:19'];
/** How far each order has travelled. The two that left are why the second outcome exists. */
const LEFT = [true, true, false, false, false];

export default function C5() {
  const [, theme] = useStyletron();
  const { cast } = useSector();

  const [outcome, setOutcome] = React.useState(LEAVE.id);
  React.useEffect(() => setOutcome(LEAVE.id), [cast.sector]);

  const product = productOf(cast, cast.order.lines[0].product);
  const cost = costOf(cast, product);

  /* the two prices: the one these orders were stamped with, and the one that stands now */
  const oldPrice = listPrice(cast, product, 0);
  const newPrice = Math.round(priceFrom(cost, 34) * 100) / 100;
  const perUnit = newPrice - oldPrice;

  const address = ADDRESS[cast.sector];

  /* one row per customer who took this line at the old price, with what they took */
  const rows: NoticeRow[] = cast.customers.map((customer, i) => {
    const qty = 8 + i * 6;
    const full = Math.round(qty * perUnit * 100) / 100;
    const gone = LEFT[i % LEFT.length];
    const movesUnder =
      outcome === 'restamp-all' ? full : outcome === 'restamp-here' ? (gone ? 0 : full) : 0;

    return {
      id: customer.id,
      what: customer.name,
      ref: 'A1',
      when: `${HOURS[i % HOURS.length]} · ${qty} ${product.unit}`,
      /* THE FIGURE IS WHAT MOVES under the chosen outcome, and it recomputes per row as the
         outcome changes. The difference itself is a fact about the order either way, so it rides
         the row's own clause rather than a struck-through number nothing superseded. */
      figure: { value: movesUnder, unit: '€', decimals: 2 },
      state:
        outcome === LEAVE.id
          ? ('holds' as const)
          : gone && outcome === 'restamp-here'
            ? ('gone' as const)
            : ('reopens' as const),
      consequence:
        outcome === LEAVE.id
          ? `Stands at ${oldPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${product.unit}, the price it was stamped with. The ${euros(full)} difference stays where it is.`
          : gone && outcome === 'restamp-here'
            ? `Left at ${HOURS[i % HOURS.length]} and keeps the price it went out with. The ${euros(full)} difference stays where it is.`
            : `Takes ${newPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${product.unit}, and the customer is told on the albarán.`,
    };
  });

  /* what each outcome would move, in total, on its own line under the buttons */
  const fullTotal = cast.customers.reduce((sum, _c, i) => sum + Math.round((8 + i * 6) * perUnit * 100) / 100, 0);
  const hereTotal = cast.customers.reduce(
    (sum, _c, i) => sum + (LEFT[i % LEFT.length] ? 0 : Math.round((8 + i * 6) * perUnit * 100) / 100),
    0,
  );
  const outcomes = [
    {
      id: 'restamp-all',
      label: 'Restamp them all',
      detail: `Every order below takes the new price, including the ones already on their way. ${euros(fullTotal)} moves.`,
    },
    {
      id: 'restamp-here',
      label: 'Restamp the ones still here',
      detail: `Orders that have already left keep the price they went out with. ${euros(hereTotal)} moves.`,
    },
  ];

  return (
    <DeskChassis
      dossier
      selected={cast.sector === 'fish' ? 2 : -1}
      rows={12}
      daybar={cast.sector === 'fish'}
      daylist={cast.sector === 'fish' ? undefined : { open: 2, label: 'the catalogue' }}
      height={960}
    >
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale700, minWidth: 0 }}>
        <ChangeNotice
          what={`${product.name} moved to ${newPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${product.unit}`}
          when={`${cast.hour}, ${cast.order.deliveryDay}`}
          anchor={`${oldPrice.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €/${product.unit} until now · ${cast.label}`}
          rows={rows}
          outcomes={outcomes}
          outcome={outcome}
          onOutcome={setOutcome}
          aside={
            /* THE ADDRESS, and the assumption the card stands on. Both are statements of fact
               about this screen, so they ride the screen rather than a footnote. */
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                gap: theme.sizing.scale600,
                padding: theme.sizing.scale500,
                borderRadius: theme.borders.radius200,
                background: theme.colors.backgroundSecondary,
              }}
            >
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  Where this screen lives in a {cast.label} house
                </div>
                <div style={theme.typography.ParagraphSmall}>{address.where}</div>
                <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                  {address.how_often}
                </div>
              </div>
              <div>
                <div style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
                  The assumption this card stands on
                </div>
                <div style={theme.typography.ParagraphSmall}>
                  The price stamps at confirmation, which is what puts these orders on the old
                  number and gives this screen its subject.
                </div>
              </div>
            </div>
          }
          boundary={
            <>
              Rocoto restamps the order. The albarán and the factura follow one step later, and
              what the customer sees is decided on H2.
            </>
          }
        />

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: theme.sizing.scale600 }}>
          {/* where the price moved */}
          <GRegion to="C3" height={92} label="the price change" />
          {/* what the customer has already been sent */}
          <GRegion to="H2" height={92} label="albaranes already sent" />
          {/* and where the day's numbers go */}
          <GRegion to="G2" height={92} label="today's file" />
        </div>
      </div>
    </DeskChassis>
  );
}
