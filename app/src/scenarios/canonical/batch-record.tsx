/* THE BATCH RECORD — the canonical screen behind E3.
 *
 * ONE COMPONENT, FOUR FIELD SETS. C-2 settled the sharpest question in the catalogue: D12 is a
 * per-FAMILY traceability profile, and the field set is DATA. This file is where that call is
 * either true or false. It reads `family.recordFields` and draws a row per field, filled from the
 * product. Nothing in it knows what a fisheries zone is, or a slaughterhouse approval number, or a
 * GGN — and a mixed house, merluza and media canal on one albarán, is two families in one
 * catalogue with nothing special happening.
 *
 * WHY THE BATCH AND NOT THE LINE. Traceability is a property of the goods that arrived, so it is
 * entered once at intake and printed on every albarán that draws on that lote afterwards. Putting
 * it on a line would ask for it once per sale of the same fish.
 *
 * NO ACTION. Everything on this screen was captured somewhere else — at the loading bay, at the
 * lonja, off a supplier's document. The record is what those captures left behind, and a control
 * here would invent a second place to type a fact the product already holds.
 *
 * P5 owns this file.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import type { Batch, Cast } from '../data/cast';
import { familyOf, productOf, supplierOf } from '../data/cast';
import Name from '../shell/Name';

/* ── §18.3 · WHOSE TRACEABILITY IS IT ─────────────────────────────────────────────────────────
 * `Batch.trace` is the model tick's optional per-landing field set. It is read through these two
 * so this canonical screen keeps its own dependency direction — nothing in `scenarios/` imports
 * from `app/` — and so the day the field is on the type there is one place to simplify.
 */
const lotTrace = (batch: unknown): Record<string, string> | undefined => {
  const held = (batch as { trace?: unknown } | null | undefined)?.trace;
  return held && typeof held === 'object' ? (held as Record<string, string>) : undefined;
};

const lotOwn = (batch: unknown, field: string): boolean => Boolean(lotTrace(batch)?.[field]);

export type BatchRecordProps = {
  cast: Cast;
  batch: Batch;
  /** where the facts came from, and where they go next. One line, on the record it justifies. */
  provenance?: React.ReactNode;
  /** what stands beside the record — the photograph the intake retained, the ledger it lives in */
  aside?: React.ReactNode;
  /** what this record prints on, at the foot */
  consumers?: React.ReactNode;
};

export default function BatchRecord({ cast, batch, provenance, aside, consumers }: BatchRecordProps) {
  const [, theme] = useStyletron();
  const product = productOf(cast, batch.product);
  const family = familyOf(cast, product);
  const supplier = supplierOf(cast, batch.supplier);

  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: aside ? 'minmax(0, 1fr) 260px' : 'minmax(0, 1fr)',
        gap: theme.sizing.scale700,
        alignItems: 'start',
        minWidth: 0,
      }}
    >
      <section
        style={{
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          background: theme.colors.backgroundPrimary,
          minWidth: 0,
        }}
      >
        {/* ── which lote this is, and what is in it ── */}
        <header
          style={{
            display: 'flex',
            gap: theme.sizing.scale500,
            alignItems: 'flex-start',
            justifyContent: 'space-between',
            flexWrap: 'wrap',
            padding: theme.sizing.scale600,
            borderBottom: `1px solid ${theme.colors.borderOpaque}`,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400 }}>
              <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.primary}>
                {batch.id}
              </Tag>
              <span style={theme.typography.HeadingXSmall}>
                <Name of={product} />
              </span>
            </div>
            <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              <Name of={supplier} /> · landed {batch.day} · {batch.qty} {product.unit} on hand
            </div>
          </div>
          {/* the family is the reason the rows below are the rows below */}
          <div style={{ textAlign: 'right', minWidth: 0 }}>
            <div
              style={{
                ...theme.typography.LabelXSmall,
                color: theme.colors.contentTertiary,
                textTransform: 'uppercase',
                letterSpacing: '0.06em',
              }}
            >
              Family
            </div>
            <div style={theme.typography.LabelSmall}>{family.name}</div>
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
              D12 · {family.traceability}
            </div>
          </div>
        </header>

        {/* ── THE FIELD SET. One block, different rows, read from the family. ── */}
        {family.recordFields.length > 0 ? (
          <dl
            style={{
              margin: 0,
              padding: theme.sizing.scale600,
              display: 'grid',
              gridTemplateColumns: 'minmax(120px, 180px) minmax(0, 1fr)',
              columnGap: theme.sizing.scale600,
              rowGap: theme.sizing.scale300,
            }}
          >
            {family.recordFields.map((field) => (
              <React.Fragment key={field}>
                <dt
                  style={{
                    ...theme.typography.LabelXSmall,
                    color: theme.colors.contentTertiary,
                    textTransform: 'uppercase',
                    letterSpacing: '0.06em',
                  }}
                >
                  {field}
                </dt>
                {/* ── §18.3 · THE CRATE'S OWN VALUE OUTRANKS THE GOODS' ────────────────────
                    «Same SKU, lots differing on quality · maturity · TRACEABILITY ATTRIBUTES.»
                    The field sets hang off the product, which is right for what the goods
                    normally are and wrong for what a particular landing carried: two lotes of
                    one merluza can come off different zonas with different artes, and the record
                    of a lote has to be able to say so. So the LOTE's value stands where it has
                    one, the product's where it does not — and the row marks which it is drawing,
                    because «this crate's zona» and «this fish's zona» are different claims.
                    `Batch.trace` is read defensively for the same reason the catalogue reads
                    `Product.code` that way: one seam, written once. */}
                <dd
                  style={{ margin: 0, ...theme.typography.ParagraphSmall, minWidth: 0 }}
                  data-lot-own={lotOwn(batch, field) ? 'yes' : undefined}
                >
                  {lotTrace(batch)?.[field] || product.trace[field] || '—'}
                  {lotOwn(batch, field) && (
                    <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentTertiary }}>
                      {' · this lote'}
                    </span>
                  )}
                </dd>
              </React.Fragment>
            ))}
          </dl>
        ) : (
          /* the family that records nothing. The block holds its shape and says what IS. */
          <p style={{ margin: 0, padding: theme.sizing.scale600, ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            This family travels on its quantity alone, and group K takes Lotes off the rail.
          </p>
        )}

        {provenance && (
          <p
            style={{
              margin: 0,
              padding: theme.sizing.scale600,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              ...theme.typography.ParagraphSmall,
              color: theme.colors.contentSecondary,
            }}
          >
            {provenance}
          </p>
        )}

        {consumers && (
          <div
            style={{
              padding: theme.sizing.scale600,
              borderTop: `1px solid ${theme.colors.borderOpaque}`,
              display: 'flex',
              gap: theme.sizing.scale300,
              flexWrap: 'wrap',
              alignItems: 'center',
            }}
          >
            {consumers}
          </div>
        )}
      </section>

      {aside && <div style={{ minWidth: 0 }}>{aside}</div>}
    </div>
  );
}
