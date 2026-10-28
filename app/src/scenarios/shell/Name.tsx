/* THE NAME — C-9's naming law, made mechanical.
 *
 * No name is typed into a screen (law 10). Every product, customer, supplier and batch comes from
 * `data/cast.ts`, and some of those names are the founder's and some are not yet. A name that is
 * still provisional is drawn with a HAIRLINE UNDERLINE, and the card carries one «name pending»
 * chip. Changing the meat cast later is one edit to one file and zero screens.
 *
 * The underline is a dotted rule and nothing else: no colour, no italic, no asterisk. A word the
 * founder has not chosen is still the word on the screen, and it should read as one.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import type { Named } from '../data/cast';

export default function Name({ of }: { of: Named }) {
  const [, theme] = useStyletron();
  if (!of.provisional) return <>{of.name}</>;
  return (
    <span
      title="name pending"
      style={{
        borderBottom: `1px dotted ${theme.colors.contentTertiary}`,
      }}
    >
      {of.name}
    </span>
  );
}

/** Does anything on screen carry a name the founder has not given yet? The card's chip reads this. */
export const hasProvisional = (parts: Array<{ provisional?: boolean }>): boolean =>
  parts.some((p) => p.provisional);
