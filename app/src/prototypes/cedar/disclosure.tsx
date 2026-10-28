import * as React from 'react';
import { useStyletron } from 'baseui';
import { ChevronDown } from 'lucide-react';

/** Collapsed content remains mounted for a reversible 400ms transition and loses focus access. */
export function Disclosure({ title, children, forceOpen = false, testId }: {
  title: React.ReactNode; children: React.ReactNode; forceOpen?: boolean; testId?: string;
}) {
  const [css, theme] = useStyletron();
  const [chosen, setChosen] = React.useState(false);
  const expanded = forceOpen || chosen;
  const id = React.useId();
  const body = React.useRef<HTMLDivElement>(null);
  React.useEffect(() => { if (body.current) body.current.inert = !expanded; }, [expanded]);
  const headingClass = css({
    width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale500,
    padding: theme.sizing.scale600, minHeight: '72px', textAlign: 'left', boxSizing: 'border-box', border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius300, backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary,
    cursor: forceOpen ? 'default' : 'pointer', ':hover': { backgroundColor: forceOpen ? theme.colors.backgroundPrimary : theme.colors.backgroundSecondary },
    ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '2px' },
  });
  return <div data-testid={testId} style={{ minWidth: 0 }}>
    {forceOpen ? <div role="heading" aria-level={3} className={headingClass}>{title}</div>
      : <button type="button" aria-expanded={expanded} aria-controls={id} onClick={() => setChosen(!expanded)} className={headingClass}>
        {title}<ChevronDown size={18} aria-hidden className={css({ flexShrink: 0, transform: expanded ? 'rotate(180deg)' : 'rotate(0deg)',
          transition: 'transform 400ms ease', '@media (prefers-reduced-motion: reduce)': { transition: 'none' } })} />
      </button>}
    <div id={id} ref={body} aria-hidden={!expanded} className={css({ display: 'grid', gridTemplateRows: expanded ? '1fr' : '0fr',
      opacity: expanded ? 1 : 0, transition: 'grid-template-rows 400ms ease, opacity 400ms ease',
      '@media (prefers-reduced-motion: reduce)': { transition: 'none' } })}>
      {/* 16 PX BETWEEN THE ROWS OF ONE SECTION (THE-OUTPUTS-SPEC OUT-02.3's 8 / 16 / 32 ladder).
          This gap was `scale500`, which measures 12 and put the export library's rows one step
          below the ladder its own spec states; `scale600` is the 16 the rule names, so the three
          steps a person reads — inside a row, between rows, between sections — are 8, 16 and 32.
          Measured by `drives/drive-200-library.py` (`BETWEEN_ROWS`). */}
      <div style={{ minHeight: 0, overflow: 'hidden' }}><div style={{ display: 'grid', gap: theme.sizing.scale600, paddingTop: theme.sizing.scale600 }}>{children}</div></div>
    </div>
  </div>;
}
