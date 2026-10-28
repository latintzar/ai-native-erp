import * as React from 'react';
import { useStyletron } from 'baseui';
import { Check, ChevronRight } from 'lucide-react';

/* THE SHORT CARD IS A LAYOUT INTENT, AND THE CALL SITE STATES IT (§246 review · 13 September 2026).
 * Banking holds one card, so it is drawn shorter than the groups that hold two or three. That
 * height was first decided by `name === 'Bank account'` — and `name` is COPY: the Spanish snapshot
 * rewrites it to «Cuenta bancaria», the comparison stopped matching, and the Banca card grew 48px
 * in Castellano alone. It then rode on `testId === 'payment-connection'`, which reads the same in
 * every language and is still a guess made INSIDE the card about the group it stands in. The prop
 * is the whole answer now: `areas/admin/connections.tsx` marks the card it wants short, and this
 * component draws what it is told. */

/** One connection, one action. Provider identity stays visible at every viewport width. */
export function ConnectionCard({ name, description, logos, status, connected = false, compact = false, onOpen, testId }: {
  name: string; description: string; logos: string[]; status: string; connected?: boolean;
  compact?: boolean; onOpen: () => void; testId: string;
}) {
  const [css, theme] = useStyletron();
  const short = compact;
  return <button data-testid={testId} onClick={onOpen} className={css({ display: 'grid', textAlign: 'left',
    gridTemplateRows: 'auto 1fr auto', gap: theme.sizing.scale600, minWidth: 0, minHeight: short ? '172px' : '220px',
    padding: theme.sizing.scale700, border: `1px solid ${theme.colors.borderOpaque}`, borderRadius: theme.borders.radius400,
    backgroundColor: theme.colors.backgroundPrimary, color: theme.colors.contentPrimary, cursor: 'pointer',
    transition: 'background-color 400ms ease, border-color 400ms ease',
    ':hover': { backgroundColor: theme.colors.backgroundSecondary, borderColor: theme.colors.borderSelected },
    ':focus-visible': { outline: `2px solid ${theme.colors.contentPrimary}`, outlineOffset: '3px' },
    '@media (prefers-reduced-motion: reduce)': { transition: 'none' },
  })}>
    <span style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: theme.sizing.scale400 }}>
      <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minHeight: 44 }}>
        {logos.map(logo => <img key={logo} src={logo} alt="" width={/prometeo/.test(logo) ? 57 : /microsoft/.test(logo) ? 92 : /bbva/.test(logo) ? 64 : /nubefact/.test(logo) ? 104 : /yape/.test(logo) ? 36 : 44} height={40} style={{ objectFit: 'contain' }} />)}
      </span><ChevronRight size={18} aria-hidden />
    </span>
    <span style={{ display: 'grid', alignContent: 'start', gap: theme.sizing.scale300 }}>
      <strong style={theme.typography.HeadingXSmall}>{name}</strong>
      <span style={{ ...theme.typography.ParagraphSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{description}</span>
    </span>
    <span style={{ display: 'flex', gap: theme.sizing.scale300, alignItems: 'center', ...theme.typography.LabelSmall,
      color: connected ? theme.colors.contentPositive : theme.colors.contentSecondary }}>
      {connected && <Check size={16} aria-hidden />}{status}
    </span>
  </button>;
}

/* ── A CARD THAT IS A STATEMENT RATHER THAN A DOOR (§247.2 · review finding 7) ─────────────────
 * `ConnectionCard` is a button, because every other card opens the setup that changes what it
 * says. This one names a fact this workspace has nothing to press about — an account an operator
 * bound to another workspace — so it is that same card standing still: same ground, same border,
 * same rows, and one sentence where the status word goes. It stood in `areas/admin/connections.tsx`
 * while that file and this one had different owners, and it lives beside the card it is a posture
 * of since 13 September 2026. */
export function ConnectionState({ name, logos, says, testId }: { name: string; logos: string[]; says: string; testId: string }) {
  const [, theme] = useStyletron();
  return <div data-testid={testId} data-acts="no" style={{ display: 'grid', textAlign: 'left',
    gridTemplateRows: 'auto 1fr auto', gap: theme.sizing.scale600, minWidth: 0, minHeight: '220px',
    padding: theme.sizing.scale700, border: `1px solid ${theme.colors.borderOpaque}`,
    borderRadius: theme.borders.radius400, backgroundColor: theme.colors.backgroundPrimary,
    color: theme.colors.contentPrimary }}>
    <span style={{ display: 'flex', alignItems: 'center', gap: theme.sizing.scale400, minHeight: 44 }}>
      {logos.map(logo => <img key={logo} src={logo} alt="" width={44} height={40} style={{ objectFit: 'contain' }} />)}
    </span>
    <strong style={{ ...theme.typography.HeadingXSmall, alignSelf: 'start' }}>{name}</strong>
    <span style={{ ...theme.typography.LabelSmall, color: theme.colors.contentSecondary, overflowWrap: 'anywhere' }}>{says}</span>
  </div>;
}

export function ConnectionGroup({ name, children }: { name: string; children: React.ReactNode }) {
  const [css, theme] = useStyletron();
  return <section style={{ display: 'grid', gap: theme.sizing.scale600 }}>
    <h2 style={{ ...theme.typography.HeadingSmall, margin: 0 }}>{name}</h2>
    <div className={css({ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(min(240px, 100%), 1fr))', gap: theme.sizing.scale600 })}>{children}</div>
  </section>;
}
