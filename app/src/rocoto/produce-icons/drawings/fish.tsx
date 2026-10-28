/* FISH — whole · fillet · loin · diced.
 *
 * The four are drawn to be told apart by SILHOUETTE alone, because at 16px the tones are three
 * smudges and the outline is all that survives: the whole fish is a lens with a forked tail, the
 * fillet is a long taper three times as wide as it is tall, the loin is a short domed block with
 * flat cut ends, and the diced is four cubes in a scatter. Cover the colour and they are still
 * four different objects — that is the test each of these had to pass.
 *
 * A live fish is silver over pale: dark back, bright belly. Both bands are painted inside a clip
 * of the body, so the body outline is one path and the countershading costs nothing at the edge.
 */
import * as React from 'react';
import type { Draw } from './draw';
import { cube } from './draw';

const BODY = 'M21 12c-2.9 3.5-6.6 5.4-10.4 5.4C6.9 17.4 4.2 15 4.2 12s2.7-5.4 6.4-5.4c3.8 0 7.5 1.9 10.4 5.4z';

export const fishWhole: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={BODY} />
      </clipPath>
    </defs>
    {/* the tail and fins first, so the body's edge covers where they join it */}
    <path d="M6 12L1.4 7.4C.9 6.9.1 7.3.1 8v.4L2.7 12 .1 15.6V16c0 .7.8 1.1 1.3.6L6 12Z" {...ink('seaShade')} />
    <path d="M9.8 7.4c1.3-2.1 3.3-3.4 5.4-3.5-.4 1.7-1.6 3.1-3.2 4z" {...ink('seaShade')} />
    <path d="M15.4 13.2c1.6.1 2.9.9 3.5 2.1-1.5.4-3.1 0-4.1-1z" {...ink('seaShade')} />
    <path d={BODY} {...ink('sea')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 13.4c3.2 1.8 6.6 2.6 10 2.6s6.8-.8 10-2.6V22H2z" {...ink('shell')} />
      <path d="M2 10.6c3-2.2 6.4-3.2 10-3.2s7 1 10 3.2V2H2z" {...ink('seaShade')} />
    </g>
    <circle cx="17.9" cy="11.2" r="1.35" {...ink('shell')} />
    <circle cx="17.9" cy="11.2" r="0.75" {...ink('seaShade')} />
  </>
);

const FILLET = 'M2.6 13.4c0-2.2 3.3-4.2 7.9-5 4.3-.8 8.5-.4 10.4 1 1 .7.8 1.8-.5 2.6-3.2 2-8 3.7-12.3 4.4-3.7.6-5.5-.5-5.5-3z';

export const fishFillet: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={FILLET} />
      </clipPath>
    </defs>
    <path d={FILLET} {...ink('flesh')} />
    <g clipPath={`url(#${uid}f)`}>
      {/* the skin, left on: the band that says this came off a fish and not out of a tin */}
      <path d="M1 11c1.6 2.2 4 3.4 7.1 3.2 4.4-.3 9.7-2.4 13.9-5.4V22H1z" {...ink('sea')} />
      <path d="M1 12.6c1.6 2.2 4 3.4 7.1 3.2 4.4-.3 9.7-2.4 13.9-5.4V22H1z" {...ink('seaShade')} />
      {/* the muscle flakes, running across the grain */}
      <path d="M10.4 8.6c-.7 1.9-1 3.9-.9 6l-1.5.3c-.1-2.3.2-4.5 1-6.5z" {...ink('fleshShade')} />
      <path d="M14.8 8.8c-.7 1.9-1 3.8-.9 5.8l-1.5.4c-.1-2.2.2-4.4 1-6.3z" {...ink('fleshShade')} />
      <path d="M18.8 9.6c-.6 1.6-.8 3.1-.7 4.7l-1.5.5c-.1-1.9.1-3.7.8-5.4z" {...ink('fleshShade')} />
    </g>
  </>
);

/* THE LOIN, twice redrawn. Wide with a broad grey lid it read as a sardine tin; narrow with two
 * upright grooves it read as a barrel. Both failures were SYMMETRY — a block with a mirror axis
 * reads as a manufactured object. So the block is a wedge now, thicker at the left than the
 * right, and instead of matched grooves it carries the whorl of the cut face at the sawn end,
 * which is the one mark a tin can never have. */
const LOIN = 'M5 13c0-2.6 1.8-4.6 4.6-5.4 2.9-.8 6-.5 7.9.8 1 .7 1.5 1.6 1.5 2.6v4.4c0 1.6-1.3 2.9-2.9 2.9H8c-1.7 0-3-1.4-3-3z';

export const fishLoin: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={LOIN} />
      </clipPath>
    </defs>
    <path d={LOIN} {...ink('flesh')} />
    <g clipPath={`url(#${uid}f)`}>
      {/* the skin, a strip along the back where it was left on */}
      <path d="M3.6 13.2c1.4-2.8 4.2-4.6 7.8-5.2 3.4-.6 6.4 0 8.2 1.4V2H3.6z" {...ink('sea')} />
      <path d="M3.6 11.6c1.4-2.8 4.2-4.6 7.8-5.2 3.4-.6 6.4 0 8.2 1.4V2H3.6z" {...ink('seaShade')} />
      <path d="M3 17c4.6 1.3 12.4 1.3 18 0V22H3z" {...ink('fleshShade')} />
      {/* the whorl of the cut face — the mark of the saw, at the sawn end only */}
      <path d="M13.6 8.8c2.6 1.3 4.1 3.2 4.1 5.4 0 2-1.3 3.8-3.4 4.9l-1.3-1.3c1.7-.9 2.8-2.2 2.8-3.6 0-1.6-1.2-3.1-3.2-4.1z" {...ink('fleshShade')} />
      <path d="M8.8 9.6c-1.2 2.8-1.2 5.9 0 8.9l-1.6.2c-1.3-3.2-1.3-6.4 0-9.5z" {...ink('fleshShade')} />
    </g>
  </>
);

const D1 = cube(7.4, 9.2, 3);
const D2 = cube(15.2, 8.2, 3);
const D3 = cube(7, 16.4, 3);
const D4 = cube(15.6, 15.4, 3);

export const fishDiced: Draw = (ink) => (
  <>
    {[D3, D4, D1, D2].map((c, i) => (
      <g key={i}>
        <path d={c.left} {...ink('flesh')} />
        <path d={c.right} {...ink('fleshShade')} />
        <path d={c.top} {...ink('shell')} />
      </g>
    ))}
    {/* one cube still wearing its skin — the fleck that says these dice came off a fish */}
    <path d={D2.top} {...ink('sea')} />
  </>
);
