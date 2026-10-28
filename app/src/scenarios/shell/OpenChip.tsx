/* THE OPEN CHIP — «OPEN-4».
 *
 * A region nobody owns. It routes to `#/open/<n>`, a page carrying what the region is, why it is
 * open, who leans on it and what would settle it: OPENNESS IS A DESTINATION, NOT A FOOTNOTE.
 *
 * A closed OPEN — OPEN-4, retired by F0; OPEN-16, de-fanged by `cast.ts` — draws struck through
 * and still routes, so the hole and its patch stay on the same row for the founder.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { useRefLink } from './context';
import { openOf } from '../data/open';

export type OpenChipProps = {
  /** the number, or the whole id — both `4` and `'OPEN-4'` are accepted */
  n: number | string;
  children?: React.ReactNode;
  size?: 'default' | 'mini';
};

export const openNumber = (n: number | string): number =>
  typeof n === 'number' ? n : parseInt(String(n).replace(/[^0-9]/g, ''), 10);

export default function OpenChip({ n, children, size = 'default' }: OpenChipProps) {
  const [, theme] = useStyletron();
  const num = openNumber(n);
  const id = `OPEN-${num}`;
  const { lit, handlers } = useRefLink(id);
  const region = openOf(num);
  const closed = !!region?.closedBy;
  const mini = size === 'mini';
  return (
    <a
      href={`#/open/${num}`}
      {...handlers}
      title={region?.title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: theme.sizing.scale100,
        ...(mini ? theme.typography.LabelXSmall : theme.typography.LabelSmall),
        textDecoration: 'none',
        whiteSpace: 'nowrap',
        padding: mini ? `0 ${theme.sizing.scale200}` : `1px ${theme.sizing.scale300}`,
        borderRadius: theme.borders.radius100,
        border: `1px dashed ${lit ? theme.colors.contentPrimary : theme.colors.borderOpaque}`,
        background: lit ? theme.colors.contentPrimary : theme.colors.backgroundSecondary,
        color: lit ? theme.colors.backgroundPrimary : theme.colors.contentSecondary,
        transition: `background ${theme.animation.timing100} ${theme.animation.easeOutCurve}`,
      }}
    >
      <span style={{ textDecoration: closed ? 'line-through' : 'none' }}>{id}</span>
      {children ? (
        <span style={{ color: lit ? theme.colors.backgroundPrimary : theme.colors.contentTertiary }}>{children}</span>
      ) : null}
    </a>
  );
}
