/* MEAT — chunk · steak · diced · minced · pieces.
 *
 * Five forms of one red thing, so silhouette is doing ALL the work: a chunk has a bone sticking
 * out of it, a steak is a flat cut with a fat rim, diced is uniform cubes, minced is a bumpy heap
 * with no straight edge anywhere, and pieces are three ragged flats of different sizes. Uniform
 * versus ragged is what separates diced from pieces, and it survives to 16px because it is a
 * property of the whole arrangement rather than of any one shape.
 *
 * Fat and bone are the pale tone, always. That single rule is what stops five red blobs from
 * reading as five red blobs — every drawing here has one cream shape in it, in the place the
 * cream actually is.
 */
import * as React from 'react';
import type { Draw } from './draw';
import { cube } from './draw';

const CHUNK = 'M8.6 6.6c4.6-1.5 9.6.3 11.2 3.9 1.8 3.9-.3 8.2-4.4 9.4-4.5 1.4-9.2-.7-10.6-4.2-1.3-3.3.3-7.7 3.8-9.1z';

export const meatChunk: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={CHUNK} />
      </clipPath>
    </defs>
    {/* the bone, out of the joint — the reason this reads as a cut of meat and not as a stone */}
    <path
      d="M6.4 8.8c-1.3-1-3.1-.8-4 .5-.8 1.1-.6 2.6.4 3.5-1 .9-1.2 2.4-.4 3.5.9 1.3 2.7 1.5 4 .5z"
      {...ink('shell')}
    />
    <path d="M2.7 12.8c-1 .9-1.2 2.4-.4 3.5.9 1.3 2.7 1.5 4 .5V13z" {...ink('shellShade')} />
    <path d={CHUNK} {...ink('deep')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 15c4.8 2.6 13.8 2.4 20-1.4V22H2z" {...ink('deepShade')} />
      {/* marbling */}
      <path d="M9.6 9.4c1.6.6 2.6 1.8 3 3.6l-1.3.5c-.4-1.5-1.2-2.4-2.4-2.9z" {...ink('shell')} />
      <path d="M13.8 13.8c1.4.2 2.4 1 2.8 2.4l-1.2.6c-.4-1.1-1-1.7-2-1.9z" {...ink('shellShade')} />
    </g>
  </>
);

const STEAK = 'M6.6 6.2c4.4-1.7 9.8-.8 12.2 2 2.6 3 1.7 7.1-1.9 9.2-4 2.3-9.6 1.9-12.5-1-2.8-2.8-2-8 2.2-10.2z';

export const meatSteak: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={STEAK} />
      </clipPath>
    </defs>
    <path d={STEAK} {...ink('deep')} />
    <g clipPath={`url(#${uid}f)`}>
      {/* the fat cap, along the top edge where a butcher leaves it */}
      <path d="M2 10.6c2.6-2.9 6.4-4.5 10.4-4.3 3.6.2 6.8 1.7 8.6 3.9V2H2z" {...ink('shell')} />
      <path d="M2 15.4c5 2.2 13.4 1.8 20-1.4V22H2z" {...ink('deepShade')} />
      <path d="M8.4 11.2c1.8.3 3.2 1.3 4.2 3l-1.2.8c-.8-1.4-1.9-2.2-3.3-2.4z" {...ink('shellShade')} />
      <path d="M13.6 8.8c1.5.2 2.7 1 3.5 2.4l-1.1.7c-.7-1.1-1.6-1.8-2.7-1.9z" {...ink('shellShade')} />
    </g>
  </>
);

const M1 = cube(7.4, 9.2, 3);
const M2 = cube(15.2, 8.2, 3);
const M3 = cube(7, 16.4, 3);
const M4 = cube(15.6, 15.4, 3);

export const meatDiced: Draw = (ink) => (
  <>
    {[M3, M4, M1, M2].map((c, i) => (
      <g key={i}>
        <path d={c.left} {...ink('deep')} />
        <path d={c.right} {...ink('deepShade')} />
        <path d={c.top} {...ink('flesh')} />
      </g>
    ))}
    {/* one cube caught a seam of fat */}
    <path d={M3.top} {...ink('shell')} />
  </>
);

export const meatMinced: Draw = (ink) => (
  <>
    {/* the heap's foot, in shade — the mound sits ON something and is not floating */}
    <path d="M3.8 14.8h16.4v3.6c0 1.3-1.1 2.4-2.4 2.4H6.2c-1.3 0-2.4-1.1-2.4-2.4z" {...ink('deepShade')} />
    {/* the bumpy crown: no straight edge anywhere, which is the whole reading of «minced» */}
    <circle cx="6.6" cy="14.6" r="2.7" {...ink('deep')} />
    <circle cx="11.1" cy="14.2" r="2.9" {...ink('deep')} />
    <circle cx="15.6" cy="14.4" r="2.8" {...ink('deep')} />
    <circle cx="19.4" cy="15.2" r="2.4" {...ink('deep')} />
    <circle cx="8.8" cy="11.6" r="2.5" {...ink('deep')} />
    <circle cx="13.4" cy="11.2" r="2.6" {...ink('deep')} />
    <circle cx="17.2" cy="12.2" r="2.2" {...ink('deep')} />
    {/* strands, laid over the crown */}
    <path d="M7.4 12.4c1.3-1.4 2.9-2.1 4.8-2.1" {...ink.line('deepShade', 1.7)} />
    <path d="M13.4 9.8c1.6-.2 3 .3 4.2 1.4" {...ink.line('deepShade', 1.7)} />
    <path d="M6.2 16.4c1.7-1.1 3.5-1.5 5.4-1.2" {...ink.line('deepShade', 1.7)} />
    <path d="M14.6 15.4c1.4-.9 2.9-1.2 4.4-.9" {...ink.line('deepShade', 1.7)} />
    {/* two flecks of fat, because mince is never one colour */}
    <circle cx="10.5" cy="12.8" r="0.95" {...ink('shell')} />
    <circle cx="16.4" cy="13.8" r="0.85" {...ink('shell')} />
  </>
);

/* PIECES, REDRAWN. The first version was three ovals of the same size and they read as beans.
 * What separates «pieces» from «diced» is not the shape of any one of them — it is that they are
 * RAGGED, UNEQUAL and PILED, where dice are uniform and separate. So: three flat slabs of three
 * different sizes, overlapping, each with a fat edge along a different side. */
/* Second pass on the same problem: three smooth ovals still read as three beans. What a trimmed
 * piece has and a bean does not is STRAIGHT EDGES — a knife left them. So each slab now carries
 * two or three straight runs among its curves, and the fat sits along one of them. */
const P1 = 'M12.6 4.6l5.4-.4c1.6-.1 3 1.2 2.9 2.8l-.1 1.2c-.1 1.3-1.3 2.3-2.6 2.1l-6.2-.8c-1.9-.2-2.6-2.6-1.1-3.8z';
const P2 = 'M2.4 10.4l1.8-2.4c1.1-1.5 3.1-2 4.8-1.2l3 1.4c1.5.7 1.6 2.8.2 3.6l-2.8 1.6c-1.6.9-3.6.6-4.9-.7l-1.9-1.9c-.4-.4-.4-.9-.2-1.4z';
const P3 = 'M3.8 15.8l3-1.6c2.7-1.4 5.9-1.3 8.5.2l2.8 1.6c1.4.8 1.4 2.9 0 3.7l-2.4 1.3c-2.6 1.4-5.7 1.4-8.3-.1l-3.6-2.1c-1.3-.8-1.3-2.4 0-3z';

export const meatPieces: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}a`}><path d={P1} /></clipPath>
      <clipPath id={`${uid}b`}><path d={P2} /></clipPath>
      <clipPath id={`${uid}c`}><path d={P3} /></clipPath>
    </defs>
    <path d={P1} {...ink('deep')} />
    <g clipPath={`url(#${uid}a)`}>
      <path d="M9 9c3.6 2.4 9.2 2.2 12.6-.8V14H9z" {...ink('deepShade')} />
      <path d="M13.4 4.6c2.4-.5 4.6-.1 6.4 1.2l-1 1.3c-1.5-1-3.2-1.3-5.2-.9z" {...ink('shell')} />
    </g>
    <path d={P2} {...ink('deep')} />
    <g clipPath={`url(#${uid}b)`}>
      <path d="M1 11.6c3.4 2.4 9 2.2 12.4-.8V16H1z" {...ink('deepShade')} />
      <path d="M3.6 8.6c1.8-1.4 4-1.8 6.4-1.2l-.5 1.5c-1.9-.4-3.6-.1-5.1 1z" {...ink('shellShade')} />
    </g>
    <path d={P3} {...ink('deep')} />
    <g clipPath={`url(#${uid}c)`}>
      <path d="M2 18.2c4.4 2.6 11.2 2.4 15.4-1V24H2z" {...ink('deepShade')} />
      <path d="M6 14.6c3-1.4 6.4-1.4 9.2.1l-.9 1.5c-2.4-1.2-5.2-1.2-7.7 0z" {...ink('shell')} />
    </g>
  </>
);
