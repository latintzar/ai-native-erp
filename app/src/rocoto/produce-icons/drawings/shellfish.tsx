/* SHELLFISH — whole · peeled.
 *
 * The generic whole is a RIBBED FAN SHELL, not a prawn. Two reasons, and the second is the real
 * one: a fan covers the whole family a counter means by «marisco» — scallop, clam, mussel, cockle
 * — where a prawn only covers prawns; and the bespoke gamba roja IS a prawn, so drawing a prawn
 * here too would have put the generic and the specific within a whisker of each other at 20px,
 * which is exactly the failure the bespoke layer exists to avoid.
 *
 * BOTH REDRAWN after the first render. The fan was tall and shallowly scalloped and read as a
 * mushroom cap, so it is wider than it is high now and the lobes are twice as deep — a fan is a
 * fan because of its bottom edge. The peeled tail was a thin hook; it is built as a true annulus
 * now, four grid units thick, so it reads as a body with segments rather than as a line.
 */
import * as React from 'react';
import type { Draw } from './draw';

const FAN =
  'M12 5c5.2 0 9.4 3.9 9.4 8.6 0 1.8-.4 3.4-1.1 4.6l-2.2-1.6-2.1 2.2-2-1.8-2 2-2-2-2 1.8-2.1-2.2-2.2 1.6c-.7-1.2-1.1-2.8-1.1-4.6C2.6 8.9 6.8 5 12 5z';

/** the raised ribs, fanned from the hinge — the one thing that says «shell» and not «dome» */
const RIB = 'M11.2 5.4h1.6l1 13.4h-3.6z';
const RIB_ANGLES = [-36, -18, 0, 18, 36];

export const shellfishWhole: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={FAN} />
      </clipPath>
    </defs>
    <path d={FAN} {...ink('flesh')} />
    <g clipPath={`url(#${uid}f)`}>
      {RIB_ANGLES.map((a) => (
        <path key={a} d={RIB} transform={`rotate(${a} 12 5.6)`} {...ink('fleshShade')} />
      ))}
      <path d="M13.6 2c4.6 2 7.8 6.4 7.8 11.6 0 2.2-.6 4.2-1.6 6H24V2z" {...ink('fleshShade')} />
    </g>
    {/* the hinge, on top of the dome where a scallop's actually is */}
    <path d="M9.8 6.2c.6-1 1.4-1.5 2.2-1.5s1.6.5 2.2 1.5z" {...ink('deepShade')} />
  </>
);

/* THE PEELED TAIL, as a true annulus: outer radius 8.4, inner 4.2, centre (12,12), open from 200°
 * round to 290°. Built from arcs rather than eyeballed béziers because a curl of even thickness is
 * the only thing that reads as a body — the hand-fitted version narrowed at the top and turned
 * into a hook. */
const TAIL = 'M14.9 4.1A8.4 8.4 0 1 1 4.1 9.1L8.1 10.6A4.2 4.2 0 1 0 13.4 8.1Z';

/** the segment grooves, laid round the same ring */
const SEG = 'M11.25 3.3h1.5l-.3 4.9h-.9z';
const SEG_ANGLES = [42, 82, 122, 162, 202];

export const shellfishPeeled: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={TAIL} />
      </clipPath>
    </defs>
    {/* the tail fan, still on — it is how you know it was peeled and not cut */}
    <path d="M13.4 8.1L14.9 4.1l4.4-1.4c.8-.3 1.4.6.9 1.3l-3.1 4z" {...ink('deep')} />
    <path d={TAIL} {...ink('flesh')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 15c4.2 3.6 10.8 3.4 15-.8 2.2-2.2 3.2-5 3-7.8H24v17.6H2z" {...ink('fleshShade')} />
      {SEG_ANGLES.map((a) => (
        <path key={a} d={SEG} transform={`rotate(${a} 12 12)`} {...ink('deep')} />
      ))}
    </g>
  </>
);
