/* DAIRY and DRY GOODS — one form each.
 *
 * §7 lists forms «per family where they matter», and here they do not: nobody at this counter
 * distinguishes a form of cheese from a form of cheese the way they distinguish a fillet from a
 * loin. Inventing `dairy|whole` and `dairy|diced` to make the table look symmetrical would put a
 * distinction on the screen that the trade does not make, so both families carry `generic` and
 * the row reads honestly.
 *
 * A wedge and a sack: two silhouettes that share no edge, so the two pale families never collide.
 */
import * as React from 'react';
import type { Draw } from './draw';

const WEDGE = 'M4 13.2L19.4 8.6c.9-.3 1.8.4 1.8 1.3v6c0 1.1-.9 2-2 2H6c-1.1 0-2-.9-2-2z';

export const dairyGeneric: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={WEDGE} />
      </clipPath>
    </defs>
    <path d={WEDGE} {...ink('gold')} />
    <g clipPath={`url(#${uid}f)`}>
      {/* the cut face, lighter — the wedge came off a wheel a moment ago */}
      <path d="M17.4 6h6v14h-6z" {...ink('shell')} />
      <path d="M2 16.6c6 1.7 14 1.7 20 0V22H2z" {...ink('goldShade')} />
      <circle cx="8.6" cy="14.6" r="1.1" {...ink('goldShade')} />
      <circle cx="12.4" cy="12.8" r="1.4" {...ink('goldShade')} />
      <circle cx="14.8" cy="15.4" r="1" {...ink('goldShade')} />
    </g>
  </>
);

const SACK =
  'M5.2 11.4c0-1.7 1-3.2 2.6-3.9l-1-2.7c-.3-.7.4-1.4 1.1-1.2l4.1 1.4 4.1-1.4c.7-.2 1.4.5 1.1 1.2l-1 2.7c1.6.7 2.6 2.2 2.6 3.9v6.2c0 1.9-1.5 3.4-3.4 3.4H8.6c-1.9 0-3.4-1.5-3.4-3.4z';

export const dryGeneric: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={SACK} />
      </clipPath>
    </defs>
    <path d={SACK} {...ink('shellShade')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M4 4h4.6c-1.5 3.6-2.1 7.6-1.9 11.8H4z" {...ink('shell')} />
      <path d="M4 17.6c5.2 1.9 10.8 1.9 16 0V23H4z" {...ink('goldShade')} />
      {/* the tie, where the sack is cinched */}
      <path d="M4.4 10.4c2.2-1.1 4.7-1.7 7.6-1.7s5.4.6 7.6 1.7v2.2c-2.2-1.1-4.7-1.7-7.6-1.7s-5.4.6-7.6 1.7z" {...ink('goldShade')} />
    </g>
  </>
);
