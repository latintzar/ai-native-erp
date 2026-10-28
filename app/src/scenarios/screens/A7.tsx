/* A7 · See what will actually be sent.
 *
 * `D5.any-unit`, the conversion known and exact. The customer ordered in their unit, the catalogue
 * sells in its own, and the software converted between them.
 *
 * POSITIVE SPACE. HOW A CONVERTED QUANTITY STAYS HONEST: the customer's words and the catalogue's
 * unit both legible on one line, with the superseded value STRUCK RATHER THAN REPLACED. A product
 * that quietly rewrites what somebody asked for is a product nobody can audit; a product that
 * keeps both is one a person can check in a second. There is no action on this card, because there
 * is nothing here to decide.
 *
 * THIS CARD IS THE SHARED LOCKUP PROOF (C-5). A7, F1 and F3 are not the same screen — one is a
 * line inside a desk order card, the others are a warehouse phone list — but they are the same
 * LOCKUP: two related values on one line, both kept, both shown. That is a fourth reduction
 * category and this card is where it is argued.
 *
 * SECTOR `=`. The pair changes and the lockup does not: fish converts caja↔kg, meat pieza↔kg,
 * fruit caja↔kg. Every one of those pairs is read out of the product's own pack in `cast.ts`, so
 * running the sector switch changes the numbers and leaves the markup alone.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import DeskChassis from '../chassis/desk';
import OrderSurface, { OrderState } from '../canonical/order-surface';
import { Figure } from '../../rocoto/figure';
import { packWord, withPackPlural } from '../canonical/resolution';
import RefChip from '../shell/RefChip';
import { GThread, GCatalogue } from '../ghosts/regions';
import { customerOf, productOf } from '../data/cast';
import { useSector } from '../shell/context';

export const meta: ScenarioMeta = {
  id: 'A7',
  title: 'See what will actually be sent',
  group: 'A',
  frame: 'desk',
  ifText: 'a customer may order in any unit, and the conversion for this line is known and exact',
  dims: ['D5.any-unit'],
  job: "Show the customer's own quantity and the quantity that will leave, on one line.",
  decides:
    'how a converted quantity stays checkable — both values on one line, the superseded one struck rather than replaced',
  inherits: [
    { region: "the order card's anatomy", ref: 'A1' },
    { region: 'the rail', ref: 'K' },
    { region: 'the thread', ref: 'chat' },
    { region: 'the dossier', ref: 'J1a' },
    { region: 'the ratio this conversion runs on', ref: 'A9' },
    { region: 'the same lockup at the bench', ref: 'F1' },
  ],
  open: [
    { region: "the day's bar and the day's orders", ref: 'OPEN-1' },
    { region: 'the catalogue that holds the pack', ref: 'OPEN-2' },
  ],
  primitives: ['U10'],
  kit: ['Figure', 'Message', 'Button', 'Ghost'],
  canonical: 'order-surface',
  delta: 'lockup',
  deltaText: "the line's Figure carries a superseded value — the lockup F1 and F3 share (C-5)",
  sector: { fish: '=', meat: '=', fruit: '=' },
  drawnWith: 'fish',
  thread: [1],
  step: 3,
  fills: [],
  reads: ['record'],
  live:
    "hover the converted figure and both ends light — the customer's own words and the catalogue's unit; the sector switch changes the pair and leaves the lockup alone",
};

export default function A7() {
  const [, theme] = useStyletron();
  const { cast } = useSector();
  const [lit, setLit] = React.useState(false);

  React.useEffect(() => {
    setLit(false);
  }, [cast.sector]);

  const customer = customerOf(cast, cast.order.customer);

  /* THE CONVERTED LINE, DERIVED. The first line whose product is bought in a pack and sold in
     another unit: fish's caja of Pulpo, meat's pieza of media canal, fruit's caja of Mango. The
     ask is the quantity in the pack's unit, and it divides exactly — that is A7's condition, and
     the line where it fails is A8's card. */
  const converted = React.useMemo(() => {
    const clean = (n: number, step: number) => Math.abs(n * step - Math.round(n * step)) < 1e-9;
    const candidates = cast.order.lines
      .map((line) => {
        const product = productOf(cast, line.product);
        const pack = product.pack;
        if (!pack || pack.unit === line.unit) return null;
        return { line, product, pack, asked: line.qty / pack.factor };
      })
      .filter((c): c is { line: (typeof cast.order.lines)[number]; product: ReturnType<typeof productOf>; pack: NonNullable<ReturnType<typeof productOf>['pack']>; asked: number } => c !== null);
    /* «known and exact» is the card's condition, so the line it draws has to divide: a whole pack
       first, a clean half after it. A line that lands anywhere else is A8's card, not this one. */
    const whole = candidates.find((c) => clean(c.asked, 1));
    const half = candidates.find((c) => clean(c.asked, 2));
    const pick = whole ?? half ?? candidates[0];
    if (pick) return { ...pick, asked: Math.round(pick.asked * 10) / 10 };
    const line = cast.order.lines[0];
    const product = productOf(cast, line.product);
    return { line, product, pack: product.pack, asked: line.qty };
  }, [cast]);

  const { line, product, pack, asked } = converted;

  /* the customer's own words, verbatim from the cast — the sentence the conversion answers */
  const words = cast.order.words[0];

  const order = React.useMemo(
    () => ({
      ...cast.order,
      lines: cast.order.lines.map((l) => (l.id === line.id ? { ...l, wasQty: asked } : l)),
    }),
    [cast.order, line.id, asked],
  );

  /* «2 caja» is the kind of small wrongness that makes a screen look machine-made */
  const shownCast = withPackPlural(cast, product.id, asked);

  /* the light both ends take when the hand is on the figure */
  const glow = (on: boolean): React.CSSProperties => ({
    borderRadius: theme.borders.radius200,
    outline: `2px solid ${on ? theme.colors.contentPrimary : 'transparent'}`,
    outlineOffset: '3px',
    transition: `outline-color ${theme.animation.timing200} ${theme.animation.easeOutCurve}`,
  });

  return (
    <DeskChassis dossier selected={2} rows={11} height={900}>
      <div style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 200px', gap: theme.sizing.scale600, minWidth: 0 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
          <OrderSurface
            cast={shownCast}
            order={order}
            state={<OrderState>Waiting on you</OrderState>}
            openLine={line.id}
            renderOpenLine={() => (
              /* ── THE LOCKUP, AT FULL ATTENTION ────────────────────────────────────────────
                 Two related values on one line. Both kept, both shown. */
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto minmax(0, 1fr)',
                  gap: theme.sizing.scale600,
                  alignItems: 'center',
                  paddingTop: theme.sizing.scale500,
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: theme.sizing.scale200 }}>
                    {customer.name} asked for
                  </div>
                  <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale200, ...glow(lit) }}>
                    <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
                      &laquo;{words}&raquo;
                    </span>
                    <Figure
                      value={asked}
                      unit={pack ? packWord(asked, pack.unit) : line.unit}
                      decimals={Number.isInteger(asked) ? 0 : 1}
                      size="large"
                      overrides={{
                        Value: { style: () => ({ textDecoration: 'line-through' }) },
                        Unit: { style: () => ({ textDecoration: 'line-through' }) },
                      }}
                    />
                  </div>
                </div>

                <span
                  aria-hidden="true"
                  style={{ ...theme.typography.HeadingSmall, color: theme.colors.contentTertiary }}
                >
                  &rarr;
                </span>

                <div
                  style={{ minWidth: 0 }}
                  onMouseEnter={() => setLit(true)}
                  onMouseLeave={() => setLit(false)}
                  onFocus={() => setLit(true)}
                  onBlur={() => setLit(false)}
                  tabIndex={0}
                >
                  <div style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em', marginBottom: theme.sizing.scale200 }}>
                    What leaves the warehouse
                  </div>
                  <Figure value={line.qty} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="display" />
                </div>

                <div style={{ gridColumn: '1 / -1', display: 'flex', gap: theme.sizing.scale400, alignItems: 'baseline', flexWrap: 'wrap' }}>
                  <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, ...glow(lit) }}>
                    {product.name} is sold by the {line.unit}, and one {pack ? pack.unit : line.unit} of
                    it holds {pack ? pack.factor : 1} {line.unit}.
                  </span>
                  <RefChip to="A9" size="mini">
                    the stored ratio
                  </RefChip>
                  <RefChip to="F1" size="mini">
                    the same lockup at the bench
                  </RefChip>
                </div>
              </div>
            )}
          />

          <GCatalogue rows={6} />
        </div>

        <GThread rows={7} />
      </div>
    </DeskChassis>
  );
}
