import { solesRate } from './currency';
/* THE INTAKE ROAD — the parts every parsed document shares (FEED-IA §196.5 · §204.2 · E200.08)
 *
 * §196.5 chose Parsewise for tabular documents and named THREE kinds — albarán, catalogue, stock.
 * The runtime has read all three since it was written (`backend/app/parsewise.py` LINE_AGENTS);
 * the kit had a door for one. E200.08 opens the other two, and the way to open a door twice
 * WITHOUT the three surfaces drifting apart is to lift the albarán road's own parts here and have
 * every kind use them:
 *
 *   THE DOORS      · `SourceButton` — Take photo · Upload file · Paste, one grammar, one hit area.
 *   THE POSTURE    · `ReadingLine` — the four states THE-PARSING-SPEC names, and the sentence each
 *                    one says. A read that came back with nothing to press hands the work back.
 *   THE PROPOSALS  · `ProposalRows` — what the paper said, matched against the house's own book,
 *                    with the quantity in a seat a hand corrects before anything is written.
 *
 * §191.1 governs all three: «A capture is not an OCR result… no field is silently invented.» A row
 * that matches nothing the house sells STAYS ON SCREEN as a proposal and stays out of the count.
 * Dropping it would be the quieter failure: the evidence line says five rows, the button offers
 * three, and two lines of somebody's paper left the building without a word.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Input } from 'baseui/input';
import { Glyph, STEP, type GlyphId } from './glyphs';
import { EXTRACTION_COPY, evidenceLine, parsedQuantity, resolveParsedRow, type Extraction } from './parsing';
import type { ParsedRow } from './runtime-client';
import type { Product } from '../../scenarios/data/cast';

/* ── ONE DOOR, ONE SHAPE, EVERY SURFACE THAT TAKES A DOCUMENT ───────────────────────────────
 * Lifted from the albarán picker, where it was already the grammar: an icon over its own word, a
 * real border so it reads as a control rather than as the text beside it, and 64 px of height —
 * comfortably over the 44 px floor THE-INTERACTION-SPEC sets for a direct target. One thing is
 * ADDED to what was lifted, and the ⚠ below says why. */
export function SourceButton({ icon, children, onClick, testid }: {
  icon: GlyphId; children: React.ReactNode; onClick: () => void; testid: string;
}) {
  const [css, theme] = useStyletron();
  /* ⚠ AND THE DOOR ANSWERS THE HAND AND THE KEYBOARD (E200.08 · better-ui · better-accessibility).
     Lifted, this button carried `cursor: default` and nothing else — no hover, no focus ring. The
     kit's own card-buttons (`product-card.tsx`, `export-library.tsx`) all pair those three: the
     pointer stays an arrow because the surface is a card, and the card answers with a filled
     background under the hand and a 2 px ring under the keyboard. A 64 px control with a border and
     no state reads as a panel; worse, a person on the keyboard cannot see where they are. Inline
     styles cannot say `:hover`, which is why it stayed unsaid — so the door takes a class instead,
     and the repair reaches all three doors from one edit, which is the argument for the lift. */
  return (
    <button
      type="button"
      data-testid={testid}
      onClick={onClick}
      className={css({
        minHeight: '64px',
        minWidth: 0,
        padding: theme.sizing.scale400,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: theme.sizing.scale200,
        border: '1px solid ' + theme.colors.borderOpaque,
        borderRadius: theme.borders.radius300,
        backgroundColor: theme.colors.backgroundPrimary,
        color: theme.colors.contentPrimary,
        font: 'inherit',
        cursor: 'default',
        transitionProperty: 'background-color, border-color',
        transitionDuration: theme.animation.timing400,
        transitionTimingFunction: theme.animation.easeOutCurve,
        '@media (prefers-reduced-motion: reduce)': { transitionDuration: '0ms' },
        ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.contentPrimary },
        ':focus-visible': { outline: '2px solid ' + theme.colors.contentPrimary, outlineOffset: '-2px' },
      })}
    >
      <Glyph id={icon} size={STEP.medium} />
      <span style={{ ...theme.typography.LabelXSmall, textAlign: 'center' }}>{children}</span>
    </button>
  );
}

/** The row the doors stand in: THREE ACROSS, at every width. The albarán picker's grid goes two-up
 *  on a phone because it carries four doors and two rows of two is a square; three doors in that
 *  same grid leaves an orphan on a row of its own, and a stray edge reads as noise (better-layout).
 *  Three equal columns hold to 320 px — the label wraps to two lines there and the door keeps its
 *  64 px, well over the 44 px floor. */
export function DoorGrid({ testid, children }: { testid?: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: 'repeat(3, minmax(0, 1fr))',
        gap: theme.sizing.scale300,
        minWidth: 0,
      }}
    >
      {children}
    </div>
  );
}

/* ── THE FOUR POSTURES, AND THE ONE SENTENCE EACH SAYS ──────────────────────────────────────
 * THE-PARSING-SPEC §PAR-04.2 states the table; this is the only place the kit renders it, so the
 * albarán, the supplier list and the stock sheet cannot say it three different ways. A terminal
 * state with nothing to press carries `handBack` — the sentence that gives the work back — because
 * a finished sentence with no way on is where E195.20 found a person stranded. */
export function readingSentence(extraction: Extraction, handBack: string, handedBack: boolean): string {
  const said = extraction.state === 'reading' ? EXTRACTION_COPY.reading
    : extraction.state === 'read' ? evidenceLine(extraction.result)
    : extraction.state === 'unreachable' ? EXTRACTION_COPY.unreachable
    : EXTRACTION_COPY.unavailable;
  return handedBack ? said + ' · ' + handBack : said;
}

/* ── WHAT THE PAPER PROPOSED, BEFORE ANYBODY AGREED TO IT (§191.1) ──────────────────────────── */
export type Proposal = { key: string; row: ParsedRow; product?: Product; qty: string };

export const proposalNumber = (value: string): number => Number(value.trim().replace(',', '.'));

/** A proposal is READY when the house knows the goods and the figure is a real positive number. */
export const readyProposals = (proposals: Proposal[]): Proposal[] =>
  proposals.filter((item) => item.product && Number.isFinite(proposalNumber(item.qty)) && proposalNumber(item.qty) > 0);

/** The rows the read gave, matched against the house's own book and held where a hand can correct
 *  them. Re-matched whenever either side changes, so a product minted mid-review lands its row. */
export function useProposals(rows: ParsedRow[], products: Product[]): [Proposal[], (key: string, qty: string) => void] {
  const build = React.useCallback(() => rows.map((row, index) => ({
    key: 'proposed-' + String(index),
    row,
    product: resolveParsedRow(products, row),
    qty: parsedQuantity(row),
  })), [rows, products]);
  const [proposals, setProposals] = React.useState<Proposal[]>(build);
  React.useEffect(() => setProposals(build()), [build]);
  const setQty = React.useCallback((key: string, qty: string) => {
    setProposals((all) => all.map((row) => row.key === key ? { ...row, qty } : row));
  }, []);
  return [proposals, setQty];
}

/* ── THE COLUMN PLAN (§194.2 · §195) ─────────────────────────────────────────────────────────
 * «we have like 6 digits in some stuff, and units that use like 6 letters like manojo if they want
 * it full and skus that are like 40 characters. it STILL has to look and fit good.» So the terminal
 * is sized ONCE for the whole proposal, off its own longest quantity and longest unit — every row
 * then shares one column and the figures line up down the card, the way an invoice's do. Capped
 * twice: an absolute ceiling, and a share of the row, so a pathological unit can never eat the
 * name's column. */
export const proposalPlan = (proposals: Proposal[]): number => {
  const digits = Math.max(3, ...proposals.map((item) => item.qty.length || 1));
  const letters = Math.max(2, ...proposals.map((item) => (((item.row.unit || '').trim() || item.product?.unit) ?? '').length));
  return Math.min(240, 56 + digits * 10 + letters * 8);
};

/** The second line under a proposal's name: what the house knows about it, or what it is. */
export function proposalDetail(item: Proposal, unmatched: string): string {
  if (!item.product) return unmatched;
  return [
    item.product.code,
    item.row.price !== undefined ? 'the note says ' + solesRate(item.row.price, ((item.row.unit || '').trim() || item.product.unit)) : '',
    item.row.lot ? 'lot ' + item.row.lot : '',
  ].filter(Boolean).join(' · ');
}

/**
 * THE PROPOSAL LIST. `testid` names the family — `albaran-intake-proposed` on the albarán,
 * `stock-batch-proposed` on the stock sheet — so a drive reads the same shape by its own surface's
 * name, and the row grammar stays one grammar.
 */
export function ProposalRows({ testid, proposals, onQty, phone, unmatched }: {
  testid: string;
  proposals: Proposal[];
  onQty: (key: string, qty: string) => void;
  phone: boolean;
  /** what a row the house has never sold says about itself — a fact, never a lack */
  unmatched: string;
}) {
  const [, theme] = useStyletron();
  const plan = React.useMemo(() => proposalPlan(proposals), [proposals]);
  /* AND ON A PHONE THE TAIL SHARES THE NAME'S LINE ONLY WHEN THE PLAN SAYS IT FITS (§194.2).
     «12,5 kg» rides beside the name all day; «999.999,125 manojo» does not, at 360, so the seat
     takes its own line whole rather than shrinking into a clip. */
  const stacked = phone && plan > 150;
  return (
    <section
      data-testid={testid}
      data-rows={String(proposals.length)}
      data-ready={String(readyProposals(proposals).length)}
      style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale300, minWidth: 0 }}
    >
      {proposals.map((item) => {
        const unit = (item.row.unit || '').trim() || item.product?.unit || '';
        return (
          <div
            key={item.key}
            data-testid={testid + '-row'}
            data-matched={item.product ? 'yes' : 'no'}
            style={{
              display: 'grid',
              gridTemplateColumns: stacked ? 'minmax(0, 1fr)' : 'minmax(0, 1fr) min(' + String(plan) + 'px, 55%)',
              alignItems: stacked ? 'stretch' : 'center',
              gap: theme.sizing.scale300,
              padding: theme.sizing.scale300,
              borderRadius: theme.borders.radius300,
              background: theme.colors.backgroundSecondary,
              minWidth: 0,
            }}
          >
            <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
              <span style={{ ...theme.typography.LabelSmall, overflowWrap: 'anywhere' }}>
                {item.product ? item.product.name : item.row.name}
              </span>
              <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>
                {proposalDetail(item, unmatched)}
              </span>
            </span>
            <Input
              value={item.qty}
              aria-label={'Quantity for ' + (item.product?.name ?? item.row.name)}
              onChange={(event) => onQty(item.key, event.currentTarget.value)}
              endEnhancer={unit || undefined}
              /* THE SAME SEAT THE STOCK REVIEW TABLE USES (§195, checkout-grade consistency).
                 A review row's number carries its own box at rest, on every row, so the geometry
                 does not change because a caret happens to be in one of them. */
              /* ⚠ ONE SEAT, ONE FILL (E200.08, found by LOOKING at 390 · better-ui, surface depth).
                 Base's Root and its InputContainer carry SEPARATE backgrounds, and this seat only
                 dressed the Root: the container kept the theme's own `backgroundSecondary`, which
                 is the exact grey of the proposal row behind it — so the figure read as loose text
                 while the white showed as a 14 px sliver hanging off the right of the unit, past
                 the enhancer, like a rendering fault. The container goes transparent so the seat
                 is one white field under its inset border, and the Root's trailing padding goes so
                 the unit sits at the seat's own edge. Three doors inherit the repair at once. */
              overrides={{
                Root: { style: { minHeight: '44px', minWidth: 0, width: '100%', paddingRight: 0, backgroundColor: theme.colors.backgroundPrimary, boxShadow: 'inset 0 0 0 1px ' + theme.colors.borderOpaque, borderRadius: theme.borders.radius200 } },
                InputContainer: { style: { backgroundColor: 'transparent' } },
                Input: { props: { inputMode: 'decimal', 'data-testid': testid + '-qty' }, style: { minHeight: '44px', minWidth: 0, width: '100%', boxSizing: 'border-box', backgroundColor: 'transparent', paddingLeft: theme.sizing.scale200, paddingRight: theme.sizing.scale200, textAlign: 'right', fontVariantNumeric: 'tabular-nums' } },
                EndEnhancer: { style: { backgroundColor: 'transparent', paddingLeft: theme.sizing.scale300, paddingRight: theme.sizing.scale400, whiteSpace: 'nowrap' } },
              }}
            />
          </div>
        );
      })}
    </section>
  );
}
