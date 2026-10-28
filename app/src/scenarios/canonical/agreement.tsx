/* THE AGREEMENT — the canonical screen behind C7, C8 and C9a.
 *
 * Three situations, one subject: something is being promised to ONE customer that the general
 * rule would not have produced. Which tier applies to them (C7), a price fixed for them on one
 * product (C8), and that same price fixed against a quantity over a period (C9a).
 *
 * THE ONE LAW OF THIS SCREEN: THE GENERAL RULE IS ALWAYS ON IT. An exception is only legible next
 * to the thing it is an exception to, so what the rule would have produced stands beside what is
 * being agreed, and the gap between them is drawn rather than left to arithmetic in somebody's
 * head. C8's whole card is that gap; C7's chips each carry the price they would make; C9a adds
 * what today's cost implies about the price at the moment of signing. Same surface, three depths.
 *
 * THE TAIL IS U01'S TAIL (J2). The moment an answer is given it can be made permanent, and
 * making it permanent takes no navigation: the decision is stored on the customer's record and
 * the control becomes a Tag that says so.
 *
 * P4 owns this file. C7 is its origin; C8 is a control delta; C9a is a column delta on C8.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';
import { Figure } from '../../rocoto/figure';
import type { Cast, Customer, Product } from '../data/cast';
import Name from '../shell/Name';

/* ── THE GENERAL RULE ─────────────────────────────────────────────────────────────────────── */

export type GeneralRule = {
  /** what the rule produces for this customer, per the product's unit */
  price: number;
  /** how it got there — «tier 1, at 26% on today's cost» */
  how: React.ReactNode;
};

/** THE SIZE OF THE EXCEPTION, drawn. Nobody sets a fixed price without seeing the gap, so the gap
 *  is a figure on the screen and not a subtraction the reader performs. Ink states the direction
 *  by saying it — «under the rule» / «over the rule» — because this product has no traffic light. */
export function Gap({
  rule,
  agreed,
  unit,
}: {
  rule: number;
  agreed: number | undefined;
  unit: string;
}) {
  const [, theme] = useStyletron();
  const known = agreed !== undefined && agreed > 0;
  const delta = known ? agreed - rule : 0;
  const pct = known && rule !== 0 ? Math.abs(delta / rule) * 100 : 0;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, alignItems: 'flex-end' }}>
      <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary }}>
        The gap
      </span>
      {known ? (
        <>
          <Figure value={Math.abs(delta)} unit={unit} size="default" />
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            {pct.toLocaleString('es-ES', { maximumFractionDigits: 1 })}%{' '}
            {delta >= 0 ? 'over the rule' : 'under the rule'}
          </span>
        </>
      ) : (
        <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>
          It appears as you type
        </span>
      )}
    </div>
  );
}

/** One candidate answer (U01). Two to four of them, ordered by evidence, each carrying what it
 *  would produce — so a chip is a price and not a label. */
export function ChoiceChip({
  label,
  evidence,
  figure,
  chosen,
  onChoose,
}: {
  label: React.ReactNode;
  evidence?: React.ReactNode;
  figure?: React.ReactNode;
  chosen: boolean;
  onChoose: () => void;
}) {
  const [, theme] = useStyletron();
  return (
    <Button
      kind={chosen ? KIND.primary : KIND.secondary}
      size={SIZE.compact}
      shape={SHAPE.pill}
      onClick={onChoose}
      overrides={{ BaseButton: { style: () => ({ paddingTop: theme.sizing.scale400, paddingBottom: theme.sizing.scale400 }) } }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 2 }}>
        <span style={theme.typography.LabelSmall}>{label}</span>
        {figure}
        {evidence && <span style={theme.typography.ParagraphXSmall}>{evidence}</span>}
      </span>
    </Button>
  );
}

/** The tail every resolution in the catalogue ends on: the answer, stored, and said once.
 *
 *  `wide` lets the words run their full length. Base truncates a tag at 128px, which turns
 *  «Agreed at 18,40 €/kg» into «Agreed at 18,40 …» — an answer the reader cannot finish reading is
 *  an answer the tail failed to state. Additive: left off, nothing about the tag changes. */
export function Settled({ children, wide = false }: { children: React.ReactNode; wide?: boolean }) {
  return (
    <Tag
      closeable={false}
      kind={TAG_KIND.neutral}
      hierarchy={HIERARCHY.primary}
      contentMaxWidth={wide ? null : undefined}
    >
      {children}
    </Tag>
  );
}

/* ── THE SCREEN ───────────────────────────────────────────────────────────────────────────── */

export type AgreementProps = {
  cast: Cast;
  /** the one customer the promise is made to */
  customer: Customer;
  /** the product it is made on, where the agreement is per product */
  product?: Product;
  /** what the general rule would produce. On the screen whenever an exception is on the screen. */
  rule?: GeneralRule;
  /** why this surface is open */
  reason?: React.ReactNode;
  /** the decision itself — the chips, the field, the terms */
  children: React.ReactNode;
  /** the terms that qualify the decision — C9a's quantity and period */
  terms?: React.ReactNode;
  /** the tail: the answer, stored */
  settled?: React.ReactNode;
  /** what stands around it */
  aside?: React.ReactNode;
};

export default function Agreement({
  cast,
  customer,
  product,
  rule,
  reason,
  children,
  terms,
  settled,
  aside,
}: AgreementProps) {
  const [, theme] = useStyletron();

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <header style={{ display: 'flex', gap: theme.sizing.scale500, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={theme.typography.HeadingSmall}>
            <Name of={customer} />
          </div>
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
            {product ? (
              <>
                <Name of={product} /> · sold by the {product.unit} ·{' '}
              </>
            ) : null}
            {customer.tier} · {customer.settles} · {cast.label}
          </div>
        </div>
        {settled}
      </header>

      {reason && (
        <div
          style={{
            borderLeft: `3px solid ${theme.colors.contentPrimary}`,
            paddingLeft: theme.sizing.scale500,
            ...theme.typography.ParagraphSmall,
          }}
        >
          {reason}
        </div>
      )}

      {/* THE GENERAL RULE, beside the exception. Evidence rides the thing it justifies. */}
      {rule && product && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'baseline',
            gap: theme.sizing.scale500,
            flexWrap: 'wrap',
            padding: `${theme.sizing.scale400} ${theme.sizing.scale500}`,
            border: `1px solid ${theme.colors.borderOpaque}`,
            borderRadius: theme.borders.radius200,
            background: theme.colors.backgroundSecondary,
          }}
        >
          <div style={{ minWidth: 0 }}>
            <div style={theme.typography.LabelSmall}>What the general rule gives them</div>
            <div style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
              {rule.how}
            </div>
          </div>
          <Figure value={rule.price} unit={`€/${product.unit}`} size="default" />
        </div>
      )}

      <div
        style={{
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          padding: `${theme.sizing.scale600}`,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale600,
          minWidth: 0,
        }}
      >
        {children}
        {terms}
      </div>

      {aside}
    </div>
  );
}
