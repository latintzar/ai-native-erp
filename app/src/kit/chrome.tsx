/* The kit page's chrome — shared by every section so eleven authors produce ONE page.
 * All values are Base's own theme scales. Rocoto supplies only the brand colour and the dots.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { Redline } from './redline';

/** When set, only the Section whose title slug matches renders — this is how one family file
 *  serves a page per component, Uber-docs style, without the authors doing anything. */
export const SectionFilter = React.createContext<string | null>(null);
export const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

export const Section: React.FC<{ t: string; n?: string; children: React.ReactNode }> = ({ t, n, children }) => {
  const [, theme] = useStyletron();
  const filter = React.useContext(SectionFilter);
  if (filter && slug(t) !== filter) return null;
  return (
    <section style={{ borderTop: `2px solid ${theme.colors.contentPrimary}`, paddingTop: theme.sizing.scale600, marginTop: theme.sizing.scale1600 }}>
      <div style={{ display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale550, marginBottom: theme.sizing.scale700, flexWrap: 'wrap' }}>
        <h3 style={{ margin: 0, ...theme.typography.HeadingXSmall }}>{t}</h3>
        {n && <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, maxWidth: '80ch' }}>{n}</span>}
      </div>
      {children}
    </section>
  );
};

export const Tile: React.FC<{ name: string; rule?: string; span?: number; children: React.ReactNode }> = ({
  name, rule, span = 4, children,
}) => {
  const [css, theme] = useStyletron();
  const [specs, setSpecs] = React.useState(false);
  return (
    <div className={css({ gridColumn: `span ${span}`, minWidth: 0, '@media (max-width: 767px)': { gridColumn: '1 / -1' } })} style={{ border: `1px solid ${theme.colors.borderTransparent}`, borderRadius: theme.borders.radius300, overflow: 'hidden', background: theme.colors.backgroundSecondary }}>
      <div style={{ background: theme.colors.backgroundPrimary, padding: theme.sizing.scale800, minHeight: 128, display: 'flex', flexDirection: 'column', gap: theme.sizing.scale600, alignItems: 'flex-start', justifyContent: 'center' }}>
        <Redline on={specs}>{children}</Redline>
      </div>
      <div style={{ padding: theme.sizing.scale550, borderTop: `1px solid ${theme.colors.borderTransparent}`, display: 'flex', alignItems: 'baseline', gap: theme.sizing.scale300 }}>
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={theme.typography.LabelSmall}>{name}</div>
          {rule && <p style={{ margin: '2px 0 0', ...theme.typography.ParagraphXSmall, color: theme.colors.contentSecondary }}>{rule}</p>}
        </div>
        {/* the redline switch: hover measures, click pins, Esc unpins */}
        <button
          onClick={() => setSpecs(!specs)}
          style={{
            ...theme.typography.LabelXSmall,
            background: specs ? theme.colors.contentPrimary : 'transparent',
            color: specs ? theme.colors.backgroundPrimary : theme.colors.contentTertiary,
            border: `1px solid ${specs ? theme.colors.contentPrimary : theme.colors.borderTransparent}`,
            borderRadius: theme.borders.radius100,
            padding: '1px 7px',
            cursor: 'pointer',
            flex: 'none',
          }}
        >
          Specs
        </button>
      </div>
    </div>
  );
};

export const Grid: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'grid', gridTemplateColumns: 'repeat(12, 1fr)', gap: 14 }}>{children}</div>
);

export const Row: React.FC<{ children: React.ReactNode }> = ({ children }) => (
  <div style={{ display: 'flex', gap: 10, alignItems: 'center', flexWrap: 'wrap' }}>{children}</div>
);
