/* POULTRY — whole · pieces · wings.
 *
 * REDRAWN after reading the first render at 32px: the bird was a plump oval with its legs tucked
 * behind it, and it read as a chestnut. Poultry is read by its APPENDAGES, not its body — the
 * drumsticks have to break the silhouette, the bone has to protrude, the wing has to bend. So
 * every drawing here puts the pale bone outside the meat, where the eye can find it.
 *
 * The generic bird is drawn LEAN and keeps its neck stub: it has to cover duck and turkey as well
 * as chicken. The bespoke `pollo` is the trussed, neckless, oven-ready one.
 */
import * as React from 'react';
import type { Draw } from './draw';
import type { Ink } from '../palette';

const BIRD = 'M12 3.8c4.3 0 7.6 3.4 7.6 7.8 0 4.1-3.1 7.1-7.3 7.1h-.6c-4.2 0-7.3-3-7.3-7.1 0-4.4 3.3-7.8 7.6-7.8z';

export const poultryWhole: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={BIRD} />
      </clipPath>
    </defs>
    {/* the two legs, splayed out of the body — drawn first, so the body finishes the joint. They
      * are long on purpose: at 16px a leg that only clears the body by two pixels is a nick in
      * the outline, not a leg, and the whole drawing goes back to reading as an acorn. */}
    <path d="M10 17.4l-3.6 3.8M14 17.4l3.6 3.8" {...ink.line('gold', 3.2)} />
    <circle cx="5.9" cy="21.4" r="1.5" {...ink('shell')} />
    <circle cx="18.1" cy="21.4" r="1.5" {...ink('shell')} />
    {/* the neck, folded back — what makes this a bird and not only a chicken */}
    <path d="M6.8 8.6C5.3 7.6 4.4 6.1 4.4 4.6c0-1 .8-1.8 1.8-1.8s1.8.8 1.8 1.8c0 1.3.5 2.5 1.5 3.4z" {...ink('gold')} />
    <path d={BIRD} {...ink('gold')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M3 14.8c4.6 2.8 12.6 2.6 18-1.2V22H3z" {...ink('goldShade')} />
      <ellipse cx="9.6" cy="9.4" rx="2.6" ry="1.5" transform="rotate(-32 9.6 9.4)" {...ink('shell')} />
    </g>
  </>
);

const BACK_PIECE = 'M6.6 4.8c2.5 0 4.5 2.1 4.5 4.6s-2 4.7-4.5 4.7-4.5-2.2-4.5-4.7 2-4.6 4.5-4.6z';
const DRUM_MEAT = 'M15.4 4.4c3 0 5.4 2.7 5.4 6.1 0 3.5-2.7 6.3-6 6.3-2.9 0-5.2-2.4-5.2-5.4 0-3.9 2.7-7 5.8-7z';

export const poultryPieces: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}a`}><path d={BACK_PIECE} /></clipPath>
      <clipPath id={`${uid}b`}><path d={DRUM_MEAT} /></clipPath>
    </defs>
    <path d={BACK_PIECE} {...ink('goldShade')} />
    <g clipPath={`url(#${uid}a)`}>
      <ellipse cx="5.4" cy="7.4" rx="2" ry="1.2" transform="rotate(-36 5.4 7.4)" {...ink('gold')} />
    </g>
    {/* THE BONE — a drumstick is a bone with meat on the end of it, so the bone is drawn long */}
    <path d="M11.8 14.4l-4.8 4.9" {...ink.line('shell', 2.5)} />
    <circle cx="5.9" cy="20.2" r="1.8" {...ink('shell')} />
    <circle cx="7.5" cy="21.4" r="1.5" {...ink('shellShade')} />
    <path d={DRUM_MEAT} {...ink('gold')} />
    <g clipPath={`url(#${uid}b)`}>
      <path d="M10 12.4c3 2.4 8 2 10.8-1V18H10z" {...ink('goldShade')} />
      <ellipse cx="14" cy="7.6" rx="2.4" ry="1.4" transform="rotate(-34 14 7.6)" {...ink('shell')} />
    </g>
  </>
);

/* THE WING, authored once. A wing BENDS — that elbow is the whole read, and it is what stops the
 * shape reading as another chunk of meat. Thin at the shoulder where the bone shows, fat at the
 * flat. */
const WING =
  'M5.6 5.4c1.5-.9 3.4-.4 4.3 1.1l2.1 3.6 3.9-1.5c1.6-.6 3.4.2 4 1.8.6 1.6-.2 3.4-1.8 4l-6.4 2.5c-1.3.5-2.8 0-3.5-1.2L4.5 9.7c-.9-1.5-.4-3.4 1.1-4.3z';

export const Wing = ({ ink, tone }: { ink: Ink; tone: 'gold' | 'goldShade' }) => (
  <>
    <circle cx="4.7" cy="4.6" r="1.6" {...ink('shell')} />
    <path d={WING} {...ink(tone)} />
  </>
);

export const poultryWings: Draw = (ink) => (
  <>
    <g transform="translate(1.6 3.4) rotate(-16 12 12)">
      <Wing ink={ink} tone="goldShade" />
    </g>
    <g transform="translate(-1.2 -0.6)">
      <Wing ink={ink} tone="gold" />
    </g>
  </>
);
