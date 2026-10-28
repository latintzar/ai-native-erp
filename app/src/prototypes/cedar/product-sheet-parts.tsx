import * as React from 'react';
import { useStyletron } from 'baseui';
import { ActDot } from './glyphs';

export function SheetPart({
  title,
  lead,
  aside,
  testid,
  first,
  surface = 'plain',
  children,
}: {
  title: string;
  lead?: React.ReactNode;
  /** what rides the heading's own row — a count, a door */
  aside?: React.ReactNode;
  testid: string;
  /** the first part under the head takes no rule of its own; the head already drew one */
  first?: boolean;
  /** A quiet bounded surface for the few parts that are worked from directly. */
  surface?: 'plain' | 'card';
  children: React.ReactNode;
}) {
  const [, theme] = useStyletron();
  const contained = surface === 'card';
  return (
    <section
      data-testid={testid}
      data-sheet-surface={surface}
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: contained ? 0 : theme.sizing.scale500,
        padding: contained ? 0 : undefined,
        paddingTop: contained ? undefined : first ? 0 : theme.sizing.scale800,
        border: contained ? `1px solid ${theme.colors.borderOpaque}` : undefined,
        borderTop: contained || first ? undefined : `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: contained ? theme.borders.radius400 : undefined,
        background: contained ? theme.colors.backgroundPrimary : undefined,
        overflow: contained ? 'hidden' : undefined,
        minWidth: 0,
      }}
    >
      <div
        data-sheet-part-heading="true"
        style={{
          display: 'flex',
          alignItems: 'baseline',
          gap: theme.sizing.scale500,
          flexWrap: 'wrap',
          minWidth: 0,
          padding: contained ? `${theme.sizing.scale500} ${theme.sizing.scale600}` : undefined,
          background: contained ? theme.colors.backgroundSecondary : undefined,
          borderBottom: contained ? `1px solid ${theme.colors.borderOpaque}` : undefined,
        }}
      >
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall, flex: 1, minWidth: 0 }}>{title}</h3>
        {aside}
      </div>
      {lead && (
        <p
          style={{
            margin: 0,
            ...theme.typography.ParagraphSmall,
            color: theme.colors.contentSecondary,
            maxWidth: '58ch',
            padding: contained ? `${theme.sizing.scale400} ${theme.sizing.scale600} 0` : undefined,
          }}
        >
          {lead}
        </p>
      )}
      <div
        data-sheet-part-body="true"
        style={{
          display: 'flex',
          flexDirection: 'column',
          gap: contained ? theme.sizing.scale300 : theme.sizing.scale500,
          padding: contained ? `${theme.sizing.scale300} ${theme.sizing.scale600} ${theme.sizing.scale500}` : undefined,
          minWidth: 0,
        }}
      >
        {children}
      </div>
    </section>
  );
}

/* ── A ONE-FACT ROW (THE-APP-V2 §6, the Monzo shape) ──────────────────────────────────────────
 * Label, the sentence under it, and the number at the end. Every row on this sheet is one fact, so
 * a person reads DOWN the sheet rather than across it.
 */
export function SheetRow({
  label,
  sub,
  value,
  mark,
  testid,
}: {
  label: React.ReactNode;
  sub?: React.ReactNode;
  value?: React.ReactNode;
  /** Rocoto's own act, where the fact is one (§1) */
  mark?: boolean;
  testid?: string;
}) {
  const [, theme] = useStyletron();
  return (
    <div
      data-testid={testid}
      style={{
        display: 'grid',
        gridTemplateColumns: value ? 'minmax(min(42%, 11rem), 1fr) minmax(0, 1.25fr)' : 'minmax(0, 1fr)',
        alignItems: 'baseline',
        gap: theme.sizing.scale500,
        minHeight: 44,
        paddingTop: theme.sizing.scale400,
        paddingBottom: theme.sizing.scale400,
        borderTop: `1px solid ${theme.colors.borderOpaque}`,
        minWidth: 0,
      }}
    >
      <span style={{ display: 'flex', flexDirection: 'column', gap: theme.sizing.scale100, minWidth: 0 }}>
        <span
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: theme.sizing.scale200,
            ...theme.typography.LabelSmall,
            minWidth: 0,
            overflowWrap: 'anywhere',
          }}
        >
          {mark && <ActDot label="Rocoto set it" />}
          {label}
        </span>
        {sub && (
          <span style={{ ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>
            {sub}
          </span>
        )}
      </span>
      {value && (
        <span
          style={{
            display: 'flex',
            justifyContent: 'flex-end',
            alignItems: 'baseline',
            minWidth: 0,
            overflowWrap: 'anywhere',
            textAlign: 'right',
          }}
        >
          {value}
        </span>
      )}
    </div>
  );
}
