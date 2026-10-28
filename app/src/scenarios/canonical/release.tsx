/* THE RELEASE — the albarán at its last editable moment, and the one control that sends it.
 *
 * P6 owns this file. Two cards instantiate it: **G1** (origin — the albarán is composed, checked
 * once, and released) and **I1** (control delta — the send control alone, nested full-fidelity
 * inside a ghosted G1, contributing zero screens of its own, C-6).
 *
 * THE ALBARÁN ITSELF IS BUILT HERE, once, and read by five other cards in this package: H1 prints
 * it, H3 shows it to a stranger, H4 exports it, H5 connects it, H2 and H6 record where it went.
 * One document, seven surfaces — which is the whole argument of groups G, H and I.
 *
 * WHAT G1 DECIDES, and what it deliberately does not: everything the software can know is already
 * on the sheet — the lote, the traceability facts, the weighed quantities — and the only field a
 * hand touches is the one software cannot know, a note for the driver. The accent rule down the
 * left of the table is Rocoto's own act, marked once and riding the block it justifies.
 *
 * THE SUB-LINE IS THE SECTOR. The traceability rides a second, smaller line under the product name
 * rather than columns of its own, so the table's columns never move and only the sub-line's
 * content does (SECTORS §3, C-2). Run the sector switch and watch the column heads stay still.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Textarea, SIZE as TEXTAREA_SIZE } from 'baseui/textarea';
import { FormControl } from 'baseui/form-control';
import { Figure } from '../../rocoto/figure';
import type { Cast, Customer, Product } from '../data/cast';
import { customerOf, familyOf } from '../data/cast';
import Name from '../shell/Name';

/* ── THE DOCUMENT ─────────────────────────────────────────────────────────────────────────────
 * Every value below is DERIVED from `cast.ts`. Nothing is typed: the products, the customer, the
 * suppliers and the lote ids all come from the cast, and the sector switch rebuilds the whole
 * document from a different one without this file changing.
 */

export type TraceFact = { label: string; value: string };

export type AlbaranLine = {
  id: string;
  product: Product;
  /** what the order asked for */
  ordered: number;
  /** what the scale said — F1 fills this (`line.sent_qty`) */
  sent: number;
  unit: string;
  price: number;
  /** the batch this line drew on — E1 or E2 put it here */
  lot: string;
  /** the family's whole field set, filled from the product and the batch — E3 put it there */
  trace: TraceFact[];
};

export type Albaran = {
  /** the day and a sequence, derived from the delivery day so it moves with the cast */
  number: string;
  day: string;
  releasedAt: string;
  customer: Customer;
  lines: AlbaranLine[];
  total: number;
};

/** The house's margin, used only where the day's own order does not already carry a price. That is
 *  C3's arithmetic and nothing new: cost, margin, price. */
const HOUSE_MARGIN = 0.35;

/** A hotel's Friday delivery is long, and the layout question H1 asks is only answerable on a full
 *  sheet. Twelve lines is what a Friday looks like. */
const LINES = 12;

/** Deterministic quantities, so a screenshot of this document is the same screenshot every time.
 *  Two ramps, because a kilo and a caja are ordered in different sizes. */
const WEIGHED = [12, 6.5, 24, 9, 4, 18, 7.5, 30, 11, 5, 16, 8];
const COUNTED = [3, 2, 6, 1, 4, 2, 8, 3, 5, 2, 4, 6];
/** What the scale added or took off, line by line — F1's dual value, arriving here as one number. */
const WEIGHED_DELTA = [0.4, -0.2, 0.9, 0, 0.6, -0.4];

const round = (n: number, places = 2) => Math.round(n * 10 ** places) / 10 ** places;

/** The line's selling price. Where the day's order already carries this product, that is the price
 *  it was confirmed at (§3.2 — the price stamps at confirmation). Otherwise cost carried up by the
 *  house margin. */
const priceOf = (cast: Cast, product: Product): number => {
  const onOrder = cast.order.lines.find((l) => l.product === product.id);
  if (onOrder) return onOrder.price;
  const batch = cast.batches.find((b) => b.product === product.id) ?? cast.batches[0];
  return round(batch.cost * (1 + HOUSE_MARGIN));
};

/** The document's own number: the delivery day, then a sequence. Derived, so a different cast
 *  produces a different albarán and no digit is typed into a screen. */
export const albaranNumber = (cast: Cast): string => {
  const day = (cast.order.deliveryDay.match(/\d{2}\.\d{2}/) ?? ['22.08'])[0].replace('.', '');
  return `${day}-114`;
};

/** WHICH DOCUMENT TO BUILD. Additive, and both defaults are what G1 and H1 already got: the
 *  hotel's Friday delivery, twelve lines long. The app passes the day's FORMING document instead —
 *  a different customer, and the line count `todaysAlbaranes` gives that customer — so the strip's
 *  tile and the release screen state the same document rather than two versions of one. */
export type BuildAlbaranOptions = {
  /** Customer.id the document is for */
  customer?: string;
  /** how many lines it runs to */
  lines?: number;
};

/** THE ALBARÁN, built from the cast. Twelve lines cycling the catalogue, each with its own lote —
 *  a product that appears twice appears against two lotes, which is exactly what E2 prints when a
 *  line was divided across two batches. */
export function buildAlbaran(cast: Cast, options: BuildAlbaranOptions = {}): Albaran {
  const customer = customerOf(cast, options.customer ?? 'hotelrec');
  const count = Math.max(1, options.lines ?? LINES);
  const lines: AlbaranLine[] = Array.from({ length: count }, (_, i) => {
    const product = cast.products[i % cast.products.length];
    const family = familyOf(cast, product);
    const lot = cast.batches[(i + Math.floor(i / cast.products.length)) % cast.batches.length].id;
    const ordered = product.unit === 'kg' ? WEIGHED[i % WEIGHED.length] : COUNTED[i % COUNTED.length];
    const sent = product.variableWeight
      ? round(ordered + WEIGHED_DELTA[i % WEIGHED_DELTA.length], 1)
      : ordered;
    return {
      id: `al-${i}`,
      product,
      ordered,
      sent,
      unit: product.unit,
      price: priceOf(cast, product),
      lot,
      /* the family's own field set, filled from the product — and the lote overridden by the batch
         this line actually drew on, because the lote is a property of the batch and never of the
         product (E3). */
      trace: family.recordFields.map((label) => ({
        label,
        value: label === 'lote' ? lot : product.trace[label] ?? '',
      })),
    };
  });
  return {
    number: albaranNumber(cast),
    day: cast.order.deliveryDay,
    releasedAt: '07:05',
    customer,
    lines,
    total: round(lines.reduce((s, l) => s + l.sent * l.price, 0)),
  };
}

/* ── THE DAY'S DOCUMENTS ──────────────────────────────────────────────────────────────────────
 * One albarán per customer, for the day the cast is standing in. Six cards read this list — the
 * drop list drives off it, and the three watching records (H2, H6, and the round view) all show
 * the same documents going to the same places, which is the only reason they read as one morning.
 */

export type DayDocument = {
  number: string;
  customer: Customer;
  lines: number;
  /** when it was released */
  at: string;
};

const RELEASED = ['07:05', '07:11', '07:18', '07:24', '07:33'];

export function todaysAlbaranes(cast: Cast): DayDocument[] {
  const day = albaranNumber(cast).split('-')[0];
  return cast.customers.map((customer, i) => ({
    number: `${day}-${110 + i}`,
    customer,
    lines: 4 + ((i * 3) % 9),
    at: RELEASED[i % RELEASED.length],
  }));
}

/* ── THE TABLE ────────────────────────────────────────────────────────────────────────────────
 * ONE COLUMN SET, ALWAYS. `el papel` prints the same anatomy on a sheet; this is the screen twin,
 * and the two agree because they take the same rows and the same rule about where a fact lives.
 */

export const LINE_COLUMNS = 'minmax(0, 1fr) 92px 92px 96px';

export function AlbaranLines({
  albaran,
  /** the accent rule down the left — Rocoto's own act, marked ONCE for the whole block rather
   *  than on every field it filled, because twelve saffron rows would be a decoration and one
   *  rule beside the block is evidence */
  marked = false,
  /** the table scrolls inside the surface past this height, so the note and the gesture that ends
   *  the editable moment stay in front of the person however long the document is */
  maxHeight,
}: {
  albaran: Albaran;
  marked?: boolean;
  maxHeight?: number;
}) {
  const [, theme] = useStyletron();
  const head = (text: string, align: 'left' | 'right' = 'left') => (
    <span
      key={text}
      style={{
        ...theme.typography.LabelXSmall,
        color: theme.colors.contentTertiary,
        textTransform: 'uppercase',
        letterSpacing: '0.06em',
        textAlign: align,
      }}
    >
      {text}
    </span>
  );

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}>
      {marked && (
        <div style={{ display: 'flex' }}>
          <Tag closeable={false} kind={TAG_KIND.accent} hierarchy={HIERARCHY.primary}>
            Rocoto filled these
          </Tag>
        </div>
      )}
      <div
        style={{
          display: 'flex',
          gap: theme.sizing.scale400,
          minWidth: 0,
          ...(maxHeight ? { maxHeight, overflowY: 'auto' } : {}),
        }}
      >
        {marked && (
          <span
            style={{
              width: 2,
              flexShrink: 0,
              background: theme.colors.accent,
              borderRadius: theme.borders.radius100,
            }}
          />
        )}
        <div style={{ flex: 1, minWidth: 0 }}>
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: LINE_COLUMNS,
            gap: theme.sizing.scale400,
            alignItems: 'end',
            paddingBottom: theme.sizing.scale200,
            borderBottom: `1px solid ${theme.colors.contentPrimary}`,
          }}
        >
          {head('Product')}
          {head('Lote')}
          {head('Ordered', 'right')}
          {head('Sent', 'right')}
        </div>
        {albaran.lines.map((line) => (
          <div
            key={line.id}
            style={{
              display: 'grid',
              gridTemplateColumns: LINE_COLUMNS,
              gap: `0 ${theme.sizing.scale400}`,
              alignItems: 'baseline',
              padding: `${theme.sizing.scale300} 0`,
              borderBottom: `1px solid ${theme.colors.borderOpaque}`,
            }}
          >
            <div style={{ minWidth: 0 }}>
              <div style={theme.typography.LabelSmall}>
                <Name of={line.product} />
              </div>
              {/* THE SUB-LINE. Six facts or eight, the columns above never move. */}
              {line.trace.length > 0 && (
                <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                  {line.trace.map((f) => `${f.label} ${f.value}`).join(' · ')}
                </div>
              )}
            </div>
            <span style={{ ...theme.typography.ParagraphSmall, fontVariantNumeric: 'tabular-nums' }}>{line.lot}</span>
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <Figure value={line.ordered} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="compact" />
            </span>
            {/* WHAT LEFT. Both quantities are already columns, so the figure carries no struck
                predecessor here — the supersede lockup belongs to F1, where the pair is the whole
                subject; repeating it inside a table that already has an ORDERED column would print
                the same number twice. */}
            <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
              <Figure
                value={line.sent}
                unit={line.unit}
                decimals={line.unit === 'kg' ? 1 : 0}
                size="compact"
              />
            </span>
          </div>
        ))}
        </div>
      </div>
    </div>
  );
}

/* ── THE SCREEN ─────────────────────────────────────────────────────────────────────────────── */

export type ReleaseProps = {
  albaran: Albaran;
  /** the driver's note — the one field on this screen a hand touches */
  note: string;
  onNote: (value: string) => void;
  /** the state the document is in, on its own row */
  state?: React.ReactNode;
  /** the gesture that ends the editable moment */
  primary?: React.ReactNode;
  /** what the screen says once the document has gone */
  after?: React.ReactNode;
  /** the send control, in a house that sends at confirmation (I1) */
  send?: React.ReactNode;
  /** a block above the lines — I1 uses it to say where it stands */
  aside?: React.ReactNode;
  /** the table scrolls past this height, so the note and the gesture stay in front of the person */
  linesMaxHeight?: number;
};

export default function Release({
  albaran,
  note,
  onNote,
  state,
  primary,
  after,
  send,
  aside,
  linesMaxHeight = 380,
}: ReleaseProps) {
  const [, theme] = useStyletron();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <header style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={theme.typography.HeadingSmall}>Albarán {albaran.number}</div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            <Name of={albaran.customer} /> · {albaran.day} · {albaran.lines.length} lines
          </div>
        </div>
        {state}
      </header>

      {aside}

      <AlbaranLines albaran={albaran} marked maxHeight={linesMaxHeight} />

      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500 }}>
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
          To pay
        </span>
        <Figure value={albaran.total} unit="€" size="large" />
      </div>

      {/* THE ONE EDITABLE FIELD. Everything above it is what the software knew; this is what it
          could not. Drawn as the only control on the screen so the contrast states itself. */}
      <FormControl label="Note for the driver">
        <Textarea
          value={note}
          onChange={(e) => onNote((e.target as HTMLTextAreaElement).value)}
          rows={2}
          size={TEXTAREA_SIZE.compact}
          placeholder="Ring the bell at the side door"
        />
      </FormControl>

      {(primary || after || send) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400 }}>
          {primary}
          {after}
          {send}
        </div>
      )}
    </div>
  );
}

/** The document's state, on its own row rather than in a sentence. Ink, never a hue. */
export function ReleaseState({ children }: { children: React.ReactNode }) {
  return (
    <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
      {children}
    </Tag>
  );
}
