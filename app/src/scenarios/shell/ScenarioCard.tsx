/* THE SCENARIO CARD — one anatomy, rendered from `meta` plus the screen. BUILD-PLAN §8.2.
 *
 * A builder writes the screen and the meta and NEVER the chrome. The shell wraps every screen in
 * this, which is why fifty-eight cards drawn by seven agents read as one catalogue.
 *
 * ┌ A13-bis ─────────────────────────────────── [desk] [Δ fruit] [thread 1 · step 9] ┐
 * │  The customer says what arrived was wrong                                        │
 * │  IF   the customer reports that delivered goods were wrong                       │
 * │  JOB  Record what was wrong and what is owed back.                               │
 * │  ── the screen ──────────────────────────────────────────────────────────────    │
 * │  [ positive space, full fidelity, live · negative space, Ghost, pointered ]       │
 * │  ── the meta strip ──────────────────────────────────────────────────────────    │
 * └──────────────────────────────────────────────────────────────────────────────────┘
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { ScenarioMeta } from '../meta';
import MetaStrip from './MetaStrip';
import { useSector } from './context';

function Tag({ children, strong = false }: { children: React.ReactNode; strong?: boolean }) {
  const [, theme] = useStyletron();
  return (
    <span
      style={{
        ...theme.typography.LabelXSmall,
        padding: `1px ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius100,
        whiteSpace: 'nowrap',
        border: `1px solid ${theme.colors.borderOpaque}`,
        background: strong ? theme.colors.contentPrimary : theme.colors.backgroundPrimary,
        color: strong ? theme.colors.backgroundPrimary : theme.colors.contentSecondary,
      }}
    >
      {children}
    </span>
  );
}

function Rule({ text }: { text: string }) {
  const [, theme] = useStyletron();
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, margin: `${theme.sizing.scale700} 0 ${theme.sizing.scale500}` }}>
      <span
        style={{
          ...theme.typography.LabelXSmall,
          color: theme.colors.contentTertiary,
          textTransform: 'uppercase',
          letterSpacing: '0.06em',
        }}
      >
        {text}
      </span>
      <span style={{ flex: 1, height: 1, background: theme.colors.borderOpaque }} />
    </div>
  );
}

export type ScenarioCardProps = {
  meta: ScenarioMeta;
  children: React.ReactNode;
};

export default function ScenarioCard({ meta, children }: ScenarioCardProps) {
  const [, theme] = useStyletron();
  const { sector, cast } = useSector();
  const verdict = meta.sector[sector];
  /* C-9: a provisional name is drawn underlined wherever it lands, and the CARD says once that a
     founder sentence is outstanding. One chip, not one per word. */
  const pending = [...cast.products, ...cast.suppliers, ...cast.customers].some((p) => p.provisional);

  return (
    <article
      style={{
        background: theme.colors.backgroundPrimary,
        border: `1px solid ${theme.colors.borderOpaque}`,
        borderRadius: theme.borders.radius400,
        padding: theme.sizing.scale800,
        maxWidth: 1400,
      }}
    >
      {/* ── the head ── */}
      <header style={{ display: 'flex', gap: theme.sizing.scale600, alignItems: 'flex-start', flexWrap: 'wrap' }}>
        <div style={{ flex: 1, minWidth: 260 }}>
          <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale400 }}>
            <h1 style={{ margin: 0, ...theme.typography.HeadingSmall }}>{meta.id}</h1>
            <span style={{ ...theme.typography.HeadingXSmall, color: theme.colors.contentSecondary }}>
              {meta.title}
            </span>
          </div>
        </div>
        <div style={{ display: 'flex', gap: theme.sizing.scale200, flexWrap: 'wrap', alignItems: 'center' }}>
          <Tag>{meta.frame}</Tag>
          {meta.paper && <Tag>paper</Tag>}
          <Tag strong>{verdict} {sector}</Tag>
          {meta.thread.map((t) => (
            <Tag key={t}>
              thread {t}{meta.step ? ` · step ${meta.step}` : ''}
            </Tag>
          ))}
          {meta.nests && <Tag>nested inside {meta.nests.inside}</Tag>}
          {pending && <Tag>name pending</Tag>}
        </div>
      </header>

      {/* ── the condition and the job ── */}
      <dl style={{ margin: `${theme.sizing.scale600} 0 0`, display: 'grid', gridTemplateColumns: 'minmax(48px, 48px) 1fr', gap: `${theme.sizing.scale300} ${theme.sizing.scale500}` }}>
        <dt style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>If</dt>
        <dd style={{ margin: 0, ...theme.typography.ParagraphSmall }}>
          {meta.ifText}
          {meta.dims.length > 0 && (
            <span style={{ color: theme.colors.contentTertiary }}>
              {'  '}
              {meta.dims.map((d) => (
                <code key={d} style={{ ...theme.typography.LabelXSmall, marginLeft: theme.sizing.scale300 }}>{d}</code>
              ))}
            </span>
          )}
        </dd>
        <dt style={{ ...theme.typography.LabelXSmall, color: theme.colors.contentTertiary, textTransform: 'uppercase', letterSpacing: '0.06em' }}>Job</dt>
        <dd style={{ margin: 0, ...theme.typography.ParagraphSmall }}>{meta.job}</dd>
      </dl>

      {/* ── the screen. The sector switch lives above the rail (§8.1) and drives this. ──
          A desk screen has a natural width (the chassis declares its minWidth); when the card is
          narrower, the stage scrolls sideways rather than crushing the positive space. */}
      <Rule text="the screen" />
      <div style={{ overflowX: 'auto' }}>{children}</div>

      {/* ── the meta strip ── */}
      <Rule text="the meta strip" />
      <MetaStrip meta={meta} />
    </article>
  );
}
