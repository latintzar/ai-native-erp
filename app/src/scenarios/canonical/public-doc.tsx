/* THE PUBLIC DOCUMENT — the only Rocoto screen a restaurant ever opens.
 *
 * P6 owns this file. Three cards instantiate it: **H3** (origin — a stranger reads the albarán),
 * **H4** (control delta — the export row appears under it) and **H5** (control delta — the
 * handshake stands where the export row was).
 *
 * NO CHROME, AND THAT IS THE SUBJECT (chassis/public). What stands around the document is the
 * product's public face, and the answer is: the document. So this file decides exactly two things
 * — the reading order of an albarán for somebody who has never seen this product before, and where
 * the tail goes.
 *
 * THE HOUSE'S OWN LETTERHEAD IS A GHOST, pointing at OPEN-18. Every name on this page comes from
 * `cast.ts`, and the distributor's own identity — its name, its address, its tax number — lives on
 * the account's own surfaces, which sit outside groups A–K entirely. Drawing it would be inventing
 * a name; leaving it blank would be pretending a real albarán has no issuer. A pointered skeleton
 * is the honest third thing, and it is also, truthfully, a large part of the layout.
 *
 * THE TRACEABILITY IS THE POINT OF THE PAGE. The chef re-transcribes those fields onto their own
 * menu because the law makes them theirs too — which is the argument for capturing them once, well,
 * at 05:00 in the coldest place in the product (FLOWS §3c).
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Figure } from '../../rocoto/figure';
import { GRegion } from '../ghosts/regions';
import Name from '../shell/Name';
import type { Albaran } from './release';

export type PublicDocProps = {
  albaran: Albaran;
  /** what stands ABOVE the document. H4's export row and H5's handshake live here, because on
   *  those two cards the row is the reason the page was opened and the document is the evidence
   *  behind it — the order of the page follows the reason for the visit. */
  lead?: React.ReactNode;
  /** what stands under the document */
  tail?: React.ReactNode;
  /** the link is protected: this stands in front of the document instead of it */
  gate?: React.ReactNode;
  /** the house's own letterhead. Additive: left off, it is the pointered skeleton it has always
   *  been (the account's own surfaces sit outside groups A–K). A surface with no catalogue behind
   *  it passes its own block, because a pointer into the catalogue is a pointer at nothing there. */
  letterhead?: React.ReactNode;
};

export default function PublicDoc({ albaran, lead, tail, gate, letterhead }: PublicDocProps) {
  const [, theme] = useStyletron();

  if (gate) {
    return (
      <div
        style={{
          background: theme.colors.backgroundPrimary,
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius400,
          padding: theme.sizing.scale900,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale600,
          alignItems: 'flex-start',
        }}
      >
        {gate}
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      {lead}
      <article
        style={{
          background: theme.colors.backgroundPrimary,
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius400,
          padding: theme.sizing.scale800,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale600,
          minWidth: 0,
        }}
      >
        {/* ── the masthead ── */}
        <header
          style={{
            display: 'grid',
            gridTemplateColumns: 'minmax(0, 1fr) minmax(0, 1fr)',
            gap: theme.sizing.scale600,
            paddingBottom: theme.sizing.scale500,
            borderBottom: `2px solid ${theme.colors.contentPrimary}`,
          }}
        >
          {/* the house's own letterhead — the account's own surfaces, OPEN-18 */}
          {letterhead ?? <GRegion open={18} height={72} label="the house" />}
          <div style={{ minWidth: 0 }}>
            <div style={theme.typography.HeadingSmall}>Albarán {albaran.number}</div>
            <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              <Name of={albaran.customer} />
            </div>
            <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              {albaran.day} · delivered {albaran.releasedAt}
            </div>
          </div>
        </header>

        {/* ── the lines. The traceability rides a second line under the product name, so a chef
             reading for the scientific name and the FAO zone finds them beside the fish. ── */}
        <div style={{ minWidth: 0 }}>
          {albaran.lines.map((line, i) => (
            <div
              key={line.id}
              style={{
                display: 'grid',
                gridTemplateColumns: 'minmax(0, 1fr) 108px 108px',
                gap: `0 ${theme.sizing.scale500}`,
                alignItems: 'baseline',
                padding: `${theme.sizing.scale400} 0`,
                borderTop: i === 0 ? 'none' : `1px solid ${theme.colors.borderOpaque}`,
              }}
            >
              <div style={{ minWidth: 0 }}>
                <div style={theme.typography.LabelMedium}>
                  <Name of={line.product} />
                </div>
                {line.trace.length > 0 && (
                  <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
                    {line.trace.map((f) => `${f.label} ${f.value}`).join(' · ')}
                  </div>
                )}
              </div>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Figure value={line.sent} unit={line.unit} decimals={line.unit === 'kg' ? 1 : 0} size="compact" />
              </span>
              <span style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                <Figure value={Math.round(line.sent * line.price * 100) / 100} unit="€" size="compact" />
              </span>
            </div>
          ))}
        </div>

        {/* ── the total ── */}
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: theme.sizing.scale500,
            borderTop: `2px solid ${theme.colors.contentPrimary}`,
            paddingTop: theme.sizing.scale500,
          }}
        >
          <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
            {albaran.lines.length} lines
          </span>
          <Figure value={albaran.total} unit="€" size="large" />
        </div>
      </article>

      {tail}
    </div>
  );
}
