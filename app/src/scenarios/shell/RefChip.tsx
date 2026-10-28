/* THE CROSS-REFERENCE CHIP — «→A1».
 *
 * Every pointer in the catalogue is one of these: on a ghost region, in a meta strip, in a
 * back-reference line. It is a link to `#/<id>`, and hovering it LIGHTS the ghost region it
 * points at (and the other way round), so the web is legible without clicking anything.
 *
 * Three kinds of target, and all three route:
 *   · a card id — «A1», «J1a»
 *   · `chat` — the one settled surface, which is not a card and never will be
 *   · anything else the founder should be able to reach — it still routes, and the shell says
 *     plainly that nothing stands there yet, rather than dropping the pointer on the floor.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { useRefLink } from './context';

export type RefChipProps = {
  /** the card id, or `chat` */
  to: string;
  /** what stands in the region — «lines», «albarán». The chip reads «→A1 lines». */
  children?: React.ReactNode;
  /** the settled surface reads at higher confidence than an undecided one */
  settled?: boolean;
  size?: 'default' | 'mini';
};

export default function RefChip({ to, children, settled = false, size = 'default' }: RefChipProps) {
  const [, theme] = useStyletron();
  const { lit, handlers } = useRefLink(to);
  const mini = size === 'mini';
  return (
    <a
      href={`#/${to}`}
      {...handlers}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale100,
        ...(mini ? theme.typography.LabelXSmall : theme.typography.LabelSmall),
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        padding: mini ? `0 ${theme.sizing.scale200}` : `1px ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius100,
        border: `1px solid ${lit ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
        background: lit ? theme.colors.contentPrimary : theme.colors.backgroundPrimary,
        color: lit
          ? theme.colors.backgroundPrimary
          : settled
            ? theme.colors.contentPrimary
            : theme.colors.contentSecondary,
        transition: `background ${theme.animation.timing100} ${theme.animation.easeOutCurve}, color ${theme.animation.timing100} ${theme.animation.easeOutCurve}`,
      }}
    >
      <span aria-hidden="true">→</span>
      <span>{to}</span>
      {children ? (
        <span style={{ color: lit ? theme.colors.backgroundPrimary : theme.colors.contentTertiary }}>{children}</span>
      ) : null}
    </a>
  );
}
