/* THE META STRIP — BUILD-PLAN §8.2. Nothing on it is hand-written per card.
 *
 *   DECIDES   `meta.decides` — one decision, never a page name.
 *   INHERITS  every negative-space region with the card that owns it.
 *   OPEN      every region nobody owns. A CARD WITH AN UNACCOUNTED GREY REGION FAILS REVIEW, so
 *             this row is drawn even when it is empty, and it says so.
 *   REUSES    `primitives` + `kit`, the components at full fidelity.
 *   SAME AS   COMPUTED from `canonical` + `delta` + `deltaText`, so a card can never claim a
 *             reduction the consolidated page does not also count.
 *   LIVE      `meta.live`. The interaction it names must actually work in the screen above it.
 *   SECTOR    the three verdicts, with the sector the card was drawn against marked.
 *   LEANED ON the back-references, computed from every other card's `inherits`.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import { SECTORS, VERDICT_TEXT } from '../data/cast';
import RefChip from './RefChip';
import OpenChip, { openNumber } from './OpenChip';
import { backReferences, useCatalogue } from './context';

function Line({ label, children }: { label: string; children: React.ReactNode }) {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        display: 'grid',
        gridTemplateColumns: 'minmax(88px, 88px) 1fr',
        gap: theme.sizing.scale500,
        alignItems: 'baseline',
        padding: `${theme.sizing.scale200} 0`,
      }}
    >
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {label}
      </span>
      <div style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentPrimary, minWidth: 0 }}>
        {children}
      </div>
    </div>
  );
}

const Chips: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: theme.sizing.scale200, alignItems: 'center' }}>
      {children}
    </div>
  );
};

export default function MetaStrip({ meta }: { meta: ScenarioMeta }) {
  const [, theme] = useStyletron();
  const all = useCatalogue();
  const leanedOn = backReferences(all, meta.id);

  const sameAs =
    meta.delta === 'origin'
      ? `${meta.canonical} — this card IS the screen; the cluster deltas from it`
      : `${meta.canonical} — ${meta.deltaText}`;

  return (
    <div style={{ borderTop: `1px solid ${theme.colors.borderOpaque}`, paddingTop: theme.sizing.scale400 }}>
      <Line label="Decides">{meta.decides}</Line>

      <Line label="Inherits">
        <Chips>
          {meta.inherits.map((i) => (
            <RefChip key={`${i.ref}-${i.region}`} to={i.ref} settled={i.ref === 'chat'}>
              {i.region}
            </RefChip>
          ))}
          {meta.inherits.length === 0 && (
            <span style={{ color: theme.colors.contentTertiary }}>the frame stands alone</span>
          )}
        </Chips>
      </Line>

      <Line label="Open">
        <Chips>
          {meta.open.map((o) => (
            <OpenChip key={`${o.ref}-${o.region}`} n={openNumber(o.ref)}>
              {o.region}
            </OpenChip>
          ))}
          {meta.open.length === 0 && (
            <span style={{ color: theme.colors.contentTertiary }}>every region on this card has an owner</span>
          )}
        </Chips>
      </Line>

      <Line label="Reuses">
        <Chips>
          {[...meta.primitives, ...meta.kit].map((k) => (
            <span
              key={k}
              style={{
                ...theme.typography.LabelXSmall,
                padding: `1px ${theme.sizing.scale300}`,
                borderRadius: theme.borders.radius100,
                background: theme.colors.backgroundSecondary,
                color: theme.colors.contentSecondary,
              }}
            >
              {k}
            </span>
          ))}
        </Chips>
      </Line>

      <Line label="Same as">{sameAs}</Line>

      <Line label="Fills">
        <Chips>
          {meta.fills.map((f) => (
            <code key={f} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentSecondary }}>{f}</code>
          ))}
          {meta.reads.map((f) => (
            <code key={`r-${f}`} style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary }}>
              reads {f}
            </code>
          ))}
          {meta.fills.length === 0 && meta.reads.length === 0 && (
            <span style={{ color: theme.colors.contentTertiary }}>this card touches no junction field</span>
          )}
        </Chips>
      </Line>

      <Line label="Live">{meta.live}</Line>

      <Line label="Sector">
        <Chips>
          {SECTORS.map((s) => (
            <span key={s} style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary }}>
              <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentPrimary }}>
                {meta.sector[s]}
              </span>{' '}
              {s} {VERDICT_TEXT[meta.sector[s]]}
              {s === meta.drawnWith ? ' · drawn with this data' : ''}
            </span>
          ))}
        </Chips>
      </Line>

      <Line label="Leaned on">
        <Chips>
          {leanedOn.map((id) => (
            <RefChip key={id} to={id} size="mini" />
          ))}
          <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentTertiary }}>
            ({leanedOn.length})
          </span>
        </Chips>
      </Line>
    </div>
  );
}
