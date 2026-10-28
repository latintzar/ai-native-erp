/* THE INFERRED SLOT — a time the software worked out, and the evidence it worked it out from.
 *
 * P6 owns this file, and **I2** is its only card.
 *
 * THE ACCENT LIVES HERE, and this is the card in P6 that earns it: an inferred delivery time is
 * the AI's own act, so it carries saffron — and the moment a person corrects it, the saffron
 * LEAVES, because the value is now theirs. That transition is the clearest statement of the colour
 * law anywhere in the package: the accent is not «important», it is «Rocoto did this».
 *
 * THE EVIDENCE RIDES THE FIGURE IT JUSTIFIES (law 7). No confidence score, no explanation
 * paragraph: the two or three facts the product could actually know — this customer's standing
 * delivery days, and where their last deliveries landed — sit under the time itself.
 *
 * THE SECTOR CHANGES THE DEFAULT AND NOTHING ELSE. Fish delivers the morning it was ordered, fruit
 * the next day, meat on fixed weekly days. Same control, same evidence rows, a different answer.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Tag, KIND as TAG_KIND, HIERARCHY } from 'baseui/tag';

export type SlotEvidence = { label: string; value: string };

export type InferredSlotProps = {
  /** who and when the delivery is for */
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  /** the slot as it stands */
  slot: string;
  /** the slot Rocoto inferred, so a corrected screen can still say what it started from */
  inferred: string;
  /** what the inference stood on */
  evidence: SlotEvidence[];
  /** the correction */
  control: React.ReactNode;
  /** what stands beside the slot */
  aside?: React.ReactNode;
};

export default function InferredSlot({
  title,
  subtitle,
  slot,
  inferred,
  evidence,
  control,
  aside,
}: InferredSlotProps) {
  const [, theme] = useStyletron();
  const corrected = slot !== inferred;

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, minWidth: 0 }}>
      <header>
        <div style={theme.typography.HeadingSmall}>{title}</div>
        {subtitle && (
          <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>{subtitle}</div>
        )}
      </header>

      <section
        style={{
          border: `1px solid ${theme.colors.borderOpaque}`,
          borderRadius: theme.borders.radius300,
          padding: theme.sizing.scale600,
          display: 'flex',
          flexDirection: 'column',
          gap: theme.sizing.scale500,
          /* SAFFRON, WHILE IT IS STILL ROCOTO'S. The rule leaves the moment a hand takes the
             value over. */
          boxShadow: corrected ? 'none' : `inset 3px 0 0 0 ${theme.colors.accent}`,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale500, flexWrap: 'wrap' }}>
          <span
            style={{
              ...theme.typography.HeadingMedium,
              fontVariantNumeric: 'tabular-nums',
              whiteSpace: 'nowrap',
            }}
          >
            {slot}
          </span>
          {corrected ? (
            <Tag closeable={false} kind={TAG_KIND.neutral} hierarchy={HIERARCHY.secondary}>
              You set this
            </Tag>
          ) : (
            <Tag closeable={false} kind={TAG_KIND.accent} hierarchy={HIERARCHY.primary}>
              Rocoto set this
            </Tag>
          )}
        </div>

        {/* THE EVIDENCE, under the figure it justifies. */}
        <dl style={{ margin: 0, display: 'grid', gridTemplateColumns: 'minmax(120px, auto) minmax(0, 1fr)', gap: `${theme.sizing.scale200} ${theme.sizing.scale500}` }}>
          {evidence.map((e) => (
            <React.Fragment key={e.label}>
              <dt
                style={{
                  ...theme.typography.LabelXSmall,
                  color: theme.colors.contentTertiary,
                  textTransform: 'uppercase',
                  letterSpacing: '0.06em',
                }}
              >
                {e.label}
              </dt>
              <dd style={{ margin: 0, ...theme.typography.ParagraphSmall }}>{e.value}</dd>
            </React.Fragment>
          ))}
        </dl>

        <div style={{ maxWidth: 260 }}>{control}</div>
      </section>

      {aside}
    </div>
  );
}
