/* THE DOCUMENT CHECK — `U07`, and the canonical screen behind B2 · B3.
 *
 * A supplier's albarán arrives, the software reads it, and a person has to agree that the reading
 * and the sheet say the same thing. Everything about the screen follows from ONE decision: the
 * document and the reading are BESIDE each other, never one after the other, and pointing at
 * either end lights the other. A screen that shows a reading and hides the sheet is asking to be
 * believed; a screen that shows the sheet and hides the reading is asking to be re-read.
 *
 * THE REFUSAL IS PART OF THE SCREEN (FLOWS §3a). Rocoto holds no purchase order, so there is
 * nothing upstream to reconcile against and a three-way match is refused. A supplier's albarán
 * has exactly two checks and they are both drawn at the foot:
 *   1. THE SHEET'S OWN ARITHMETIC — do the lines add up to the total the sheet prints?
 *   2. THE COUNT AT THE BAY — did that many packages actually come off the lorry?
 * Both are computed here from what is on screen, so neither can claim something the rows deny.
 *
 * ONE HAND ON THE SCREEN. Every row is inert except the one that disagrees, and that one carries
 * the whole of the screen's interaction. B2 resolves it with two figures to choose between; B3,
 * on a phone at the bay with gloves on, resolves it by speaking — same row, same slot, different
 * control, which is the `control` delta and nothing more.
 *
 * P3 owns this file. B2 is its origin; B3 is B2 reached through a camera door (C-13).
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';
import { Paper } from '../../rocoto/paper';
import type { PaperRow } from '../../rocoto/paper';

/* ── WHAT THE SHEET SAYS, AND WHAT THE SOFTWARE READ ──────────────────────────────────────── */

export type DocCheckRow = {
  id: string;
  /** the product, drawn by the caller through `<Name />` so no name is typed (law 10) */
  name: React.ReactNode;
  /** the family's facts, riding a smaller second line under the name — one column set, always */
  sub?: Array<{ label: string; value: string }>;
  /** how much, in the unit the COST is denominated in, so a line's amount is qty × cost */
  qty: number;
  /** that unit — «kg», «caja», «pieza» */
  unit: string;
  /** how many packages that quantity came off the lorry in. The count check adds these up. */
  packs?: { count: number; unit: string };
  /** cost per `per`, as the software read it */
  cost: number;
  /** the unit the cost is denominated in — «€/kg» */
  per: string;
  /** what the SHEET says, where the sheet and the reading differ. Present ⇒ this is the row. */
  docCost?: number;
  /** the value never came off the sheet at all — the photograph could not read it (B3) */
  unread?: boolean;
};

export type DocCheckProps = {
  rows: DocCheckRow[];
  /** the block at the head of the sheet: who sent it, to whom, and what it calls itself */
  masthead: React.ReactNode;
  /** the sheet's own printed total — the first of the two checks reads it */
  statedTotal: number;
  /** HOW MANY OF THE SHEET'S LINES ACTUALLY CAME OFF THE LORRY. The count check is per LINE and
   *  not per package on purpose: a sheet carries piezas, cajas and loose kilos on adjacent rows,
   *  and a single number summed across those units is a number that means nothing. Each row still
   *  carries its own package count, which is where the granular counting lives. */
  found: number;
  /** how many lines the sheet lists */
  listed: number;
  /** the row that disagrees carries the only hand on the screen. This draws it. */
  renderResolve?: (row: DocCheckRow) => React.ReactNode;
  /** the sheet is a PHOTOGRAPH of a sheet, taken at the bay, and it says so (B3) */
  photographed?: React.ReactNode;
  /** how the sheet is scaled into its panel. 1 is life size at 96dpi. */
  scale?: number;
  /** beside on a desk; stacked on a phone */
  layout?: 'beside' | 'stacked';
  /** DRAW THE SHEET HERE. B3 turns it off, because on a phone the sheet is already on screen —
   *  it is the photograph inside the viewfinder — and drawing it twice pushes the rows that
   *  need answering below the fold, which is the only thing that card is for. */
  showDocument?: boolean;
  /** what the two ends are called */
  readingTitle?: React.ReactNode;
  documentTitle?: React.ReactNode;
};

/* ── THE LIT PAIR ─────────────────────────────────────────────────────────────────────────────
 * One id in one place, read by both ends. Clicking a row lights the line on the sheet and
 * clicking the line lights the row — the check is legible without pressing anything, which is
 * `U07`'s whole claim. */

function useLit() {
  const [lit, setLit] = React.useState<string | null>(null);
  return { lit, setLit };
}

function litStyle(on: boolean, colour: string, radius: string): React.CSSProperties {
  return {
    outline: on ? `2px solid ${colour}` : '2px solid transparent',
    outlineOffset: '2px',
    borderRadius: radius,
  };
}

export default function DocCheck({
  rows,
  masthead,
  statedTotal,
  found,
  listed,
  renderResolve,
  photographed,
  scale = 0.62,
  layout = 'beside',
  showDocument = true,
  readingTitle = 'What Rocoto read',
  documentTitle = 'The supplier’s albarán',
}: DocCheckProps) {
  const [, theme] = useStyletron();
  const { lit, setLit } = useLit();

  /* CHECK 1 — THE SHEET'S OWN ARITHMETIC: the sheet's own figures against the total the sheet
     prints. It is a fact about the paper, so it holds still while the reading is corrected. */
  const sheetTotal = rows.reduce((s, r) => s + r.qty * (r.docCost ?? r.cost), 0);
  const drift = Math.round((statedTotal - sheetTotal) * 100) / 100;

  /* WHAT THE READING MAKES OF IT. This one DOES move: settle the row that disagrees and the
     struck figure beside the reading's total leaves, because the two ends now agree. */
  const readTotal = rows.reduce((s, r) => s + r.qty * r.cost, 0);
  const apart = Math.abs(readTotal - sheetTotal) >= 0.005;

  /* CHECK 2 — the count at the bay */
  const countAgrees = found === listed;

  const paperRows: PaperRow[] = rows.map((r) => ({
    id: r.id,
    cells: {
      product: (
        <span
          role="button"
          tabIndex={0}
          onClick={() => setLit(lit === r.id ? null : r.id)}
          onKeyDown={(e) => { if (e.key === 'Enter') setLit(lit === r.id ? null : r.id); }}
          onMouseEnter={() => setLit(r.id)}
          onMouseLeave={() => setLit(null)}
          style={{ cursor: 'pointer', display: 'block', ...litStyle(lit === r.id, theme.colors.contentPrimary, theme.borders.radius100) }}
        >
          {r.name}
        </span>
      ),
      qty: r.packs ? `${r.packs.count} ${r.packs.unit} · ${r.qty} ${r.unit}` : `${r.qty} ${r.unit}`,
      cost: r.unread
        ? '—'
        : `${(r.docCost ?? r.cost).toLocaleString('es-ES', { minimumFractionDigits: 2 })} ${r.per}`,
      amount: r.unread
        ? '—'
        : `${(r.qty * (r.docCost ?? r.cost)).toLocaleString('es-ES', { minimumFractionDigits: 2 })} €`,
    },
    sub: r.sub,
  }));

  const reading = (
    <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      <h3 style={{ margin: 0, ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {readingTitle}
      </h3>

      <div style={{ border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius300, overflow: 'hidden' }}>
        {rows.map((r, i) => {
          const disagrees = r.docCost !== undefined || r.unread;
          return (
            <div
              key={r.id}
              onMouseEnter={() => setLit(r.id)}
              onMouseLeave={() => setLit(null)}
              style={{
                borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
                background: lit === r.id ? theme.colors.backgroundSecondary : 'transparent',
              }}
            >
              <div
                role="button"
                tabIndex={0}
                onClick={() => setLit(lit === r.id ? null : r.id)}
                onKeyDown={(e) => { if (e.key === 'Enter') setLit(lit === r.id ? null : r.id); }}
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'minmax(0, 1fr) auto auto',
                  gap: theme.sizing.scale500,
                  alignItems: 'baseline',
                  padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
                  cursor: 'pointer',
                }}
              >
                <div style={{ minWidth: 0 }}>
                  <div style={theme.typography.LabelMedium}>{r.name}</div>
                  {r.sub && r.sub.length > 0 && (
                    <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                      {r.sub.map((f) => `${f.label} ${f.value}`).join(' · ')}
                    </div>
                  )}
                </div>
                <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, whiteSpace: 'nowrap', textAlign: 'right' }}>
                  {r.qty} {r.unit}
                  {r.packs && (
                    <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                      {r.packs.count} {r.packs.unit}
                    </div>
                  )}
                </span>
                <div style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                  {r.unread ? (
                    <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                      say it
                    </Tag>
                  ) : (
                    <Figure
                      value={r.cost}
                      was={r.docCost}
                      unit={r.per}
                      decimals={2}
                      size="compact"
                    />
                  )}
                </div>
              </div>

              {/* THE ONLY HAND ON THE SCREEN. It rides the row it settles, because evidence rides
                  the element it justifies (law 7). */}
              {disagrees && renderResolve && (
                <div style={{ padding: `0 ${theme.sizing.scale500} ${theme.sizing.scale500}` }}>
                  {renderResolve(r)}
                </div>
              )}
            </div>
          );
        })}
      </div>

      {/* THE READING'S OWN TOTAL, with the sheet's struck beside it while the two stand apart.
          Settling the row that disagrees takes the strike away — that movement IS the check. */}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: theme.sizing.scale500 }}>
        <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
          {rows.length} lines
        </span>
        <Figure value={readTotal} was={apart ? sheetTotal : undefined} unit="€" decimals={2} size="large" />
      </div>

      {/* ── THE TWO CHECKS. Both computed, both stated as what IS. ── */}
      <dl
        style={{
          margin: 0,
          display: 'grid',
          gridTemplateColumns: 'minmax(0, 1fr)',
          gap: theme.sizing.scale300,
          padding: theme.sizing.scale500,
          borderRadius: theme.borders.radius300,
          background: theme.colors.backgroundSecondary,
        }}
      >
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, alignItems: 'baseline' }}>
          <dt style={{ ...theme.typography.LabelSmall }}>The sheet’s own arithmetic</dt>
          <dd style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, textAlign: 'right' }}>
            {Math.abs(drift) < 0.005 ? (
              <>the lines make the printed total</>
            ) : (
              <>
                the lines and the printed total stand{' '}
                <Figure value={Math.abs(drift)} unit="€" decimals={2} size="compact" /> apart
              </>
            )}
          </dd>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale400, alignItems: 'baseline' }}>
          <dt style={{ ...theme.typography.LabelSmall }}>The count at the bay</dt>
          <dd style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, textAlign: 'right' }}>
            {countAgrees ? (
              <>
                every line the sheet lists came off the lorry —{' '}
                <Figure value={found} unit={found === 1 ? 'line' : 'lines'} decimals={0} size="compact" />
              </>
            ) : (
              <>
                <Figure value={found} unit="found" decimals={0} size="compact" /> of the sheet&rsquo;s{' '}
                <Figure value={listed} unit={listed === 1 ? 'line' : 'lines'} decimals={0} size="compact" />
              </>
            )}
          </dd>
        </div>
        <p style={{ margin: `${theme.sizing.scale300} 0 0`, ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
          These are the two checks a supplier’s albarán has. Rocoto holds the goods and the sheet,
          which is what those two read; the third check a purchasing system runs needs a purchase
          order, and that lives with the buyer.
        </p>
      </dl>
    </section>
  );

  const note = photographed ? (
    <p style={{ margin: 0, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
      {photographed}
    </p>
  ) : null;

  const document = (
    <section style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale400, minWidth: 0 }}>
      <h3 style={{ margin: 0, ...theme.typography.LabelSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>
        {documentTitle}
      </h3>
      {note}
      <div
        style={{
          padding: theme.sizing.scale400,
          borderRadius: theme.borders.radius300,
          background: theme.colors.backgroundSecondary,
          border: `1px solid ${theme.colors.borderOpaque}`,
          overflow: 'auto',
          maxHeight: 620,
        }}
      >
        <Paper
          format="a4"
          scale={scale}
          masthead={masthead}
          columns={[
            { key: 'product', label: 'Producto', width: 'minmax(0, 1.6fr)' },
            { key: 'qty', label: 'Cantidad', width: '90px', align: 'end' },
            { key: 'cost', label: 'Precio', width: '96px', align: 'end' },
            { key: 'amount', label: 'Importe', width: '96px', align: 'end' },
          ]}
          rows={paperRows}
          foot={
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: theme.sizing.scale500 }}>
              <span>Total</span>
              <span>{statedTotal.toLocaleString('es-ES', { minimumFractionDigits: 2 })} €</span>
            </div>
          }
        />
      </div>
    </section>
  );

  if (layout === 'stacked') {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
        {showDocument ? document : note}
        {reading}
      </div>
    );
  }

  return (
    <div
      style={{
        display: 'grid',
        /* THE SHEET IS NOT CRUSHED. A4 at this scale has a floor, and the stage scrolls
           sideways at it rather than shrinking the page into an illegible stamp. */
        gridTemplateColumns: 'minmax(380px, 1.05fr) minmax(520px, 1fr)',
        gap: theme.sizing.scale700,
        alignItems: 'start',
        minWidth: 0,
      }}
    >
      {reading}
      {document}
    </div>
  );
}
