/* FRUIT and VEGETABLE — whole · bunch · box, twice over.
 *
 * The two families share their three forms and share the crate, and they are told apart by TONE
 * doing exactly the job tone is allowed to do here: fruit is gold and round, vegetable is green
 * and leafy. That is not a colour-coded status system — it is what the goods look like. The
 * silhouettes still differ (a stone fruit against a topped root; a berry cluster against a tied
 * bunch of leaves), so the pair survives `mono` too, which is the test that matters.
 */
import * as React from 'react';
import type { Draw } from './draw';
import { CRATE } from './draw';

const APPLE =
  'M12 7.2c1.4-1 3.2-1.4 4.8-.8 2.6 1 4 4 3.2 7.2-.9 3.6-3.8 6-6.6 5.6-.5-.1-1-.2-1.4-.4-.4.2-.9.3-1.4.4-2.8.4-5.7-2-6.6-5.6-.8-3.2.6-6.2 3.2-7.2 1.6-.6 3.4-.2 4.8.8z';

export const fruitWhole: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={APPLE} />
      </clipPath>
    </defs>
    <path d="M12 7.4l.9-3" {...ink.line('goldShade', 1.4)} />
    <path d="M13 5.2c1.7-1.7 4-2.1 5.4-1-.2 1.9-2.1 3.5-4.2 3.5-.6 0-1-.1-1.2-.4z" {...ink('leaf')} />
    <path d={APPLE} {...ink('gold')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M13.4 5.2c3.6 1.6 6 5.2 6 9.2 0 2.2-.7 4.2-1.9 5.8H24V5.2z" {...ink('goldShade')} />
      <ellipse cx="9" cy="10.6" rx="2" ry="1.2" transform="rotate(-38 9 10.6)" {...ink('shell')} />
    </g>
  </>
);

export const fruitBunch: Draw = (ink) => (
  <>
    <path d="M12 9.6V5.6" {...ink.line('goldShade', 1.4)} />
    <path d="M12.6 6.6c1.8-1.8 4.4-2.2 6-1.1-.4 2-2.5 3.6-4.7 3.6-.7 0-1.2-.1-1.5-.4z" {...ink('leaf')} />
    <circle cx="8" cy="11.6" r="2.5" {...ink('deepShade')} />
    <circle cx="12" cy="11.6" r="2.5" {...ink('deepShade')} />
    <circle cx="16" cy="11.6" r="2.5" {...ink('deepShade')} />
    <circle cx="10" cy="15.4" r="2.5" {...ink('deep')} />
    <circle cx="14" cy="15.4" r="2.5" {...ink('deep')} />
    <circle cx="12" cy="18.8" r="2.3" {...ink('deep')} />
    <ellipse cx="9.1" cy="14.5" rx="0.9" ry="0.6" transform="rotate(-40 9.1 14.5)" {...ink('flesh')} />
  </>
);

/** the crate, filled by whoever calls it — one box, two heaps */
const Crate: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}c`}>
        <path d={CRATE.body} />
      </clipPath>
    </defs>
    <path d={CRATE.body} {...ink('shellShade')} />
    <g clipPath={`url(#${uid}c)`}>
      <path d={CRATE.shade} {...ink('goldShade')} />
      <path d={CRATE.slats} {...ink('shell')} />
    </g>
    <path d={CRATE.rim} {...ink('shell')} />
  </>
);

export const fruitBox: Draw = (ink, uid) => (
  <>
    <circle cx="7.6" cy="8" r="2.6" {...ink('goldShade')} />
    <circle cx="16.4" cy="8" r="2.6" {...ink('goldShade')} />
    <circle cx="12" cy="7.2" r="3" {...ink('gold')} />
    <ellipse cx="10.6" cy="5.9" rx="1" ry="0.65" transform="rotate(-38 10.6 5.9)" {...ink('shell')} />
    {Crate(ink, uid)}
  </>
);

const ROOT =
  'M12 8.8c3.5 0 6.2 2.5 6.2 5.6 0 2.3-1.3 4-3 5-.9.5-1.9 1.6-2.4 2.5-.3.5-1.1.5-1.4 0-.5-.9-1.5-2-2.4-2.5-1.7-1-3-2.7-3-5 0-3.1 2.7-5.6 6-5.6z';

export const vegetableWhole: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={ROOT} />
      </clipPath>
    </defs>
    {/* the tops, still on — the one thing that says «vegetable» and not «egg» */}
    <path d="M12.2 9c-.7-2.6.3-5.2 2.8-6.5.9 2.6 0 5.4-2.2 6.8z" {...ink('leaf')} />
    <path d="M11.6 9c-2.4-1.1-3.7-3.7-3.2-6.5 2.6.9 4.2 3.5 3.9 6.3z" {...ink('leafShade')} />
    <path d={ROOT} {...ink('shell')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M13.2 7c3.4 1.4 5.6 4.4 5.6 8 0 2.8-1.4 5.4-3.6 7H22V7z" {...ink('shellShade')} />
    </g>
  </>
);

const BLADE =
  'M12 3.2c1.9 2.8 2.6 6 2 9.2-.4 2-1.1 3.7-2 5-.9-1.3-1.6-3-2-5-.6-3.2.1-6.4 2-9.2z';

/* THE BUNCH, REDRAWN. The first tie was a deep rounded box under the leaves and the whole thing
 * read as a potted plant. A bunch is bound, not planted — so the band is a thin strip now and the
 * cut stems carry on below it, which is the difference between «someone tied this» and «this is
 * growing in something». */
export const vegetableBunch: Draw = (ink) => (
  <>
    <path d="M11 18.4l-1.4 3.4M13 18.4l1.4 3.4M12 18.6v3.6" {...ink.line('leafShade', 1.3)} />
    <path d={BLADE} transform="rotate(-27 12 17.4)" {...ink('leafShade')} />
    <path d={BLADE} transform="rotate(27 12 17.4)" {...ink('leafShade')} />
    <path d={BLADE} {...ink('leaf')} />
    <path d="M12 6.4v9.4" {...ink.line('leafShade', 1.1)} />
    {/* the tie — a bunch is a bunch because someone bound it */}
    <path d="M8 16.4h8c.6 0 1.1.5 1.1 1.1v.8c0 .6-.5 1.1-1.1 1.1H8c-.6 0-1.1-.5-1.1-1.1v-.8c0-.6.5-1.1 1.1-1.1z" {...ink('shellShade')} />
    <path d="M11 16.4h2v3.1h-2z" {...ink('goldShade')} />
  </>
);

export const vegetableBox: Draw = (ink, uid) => (
  <>
    <path d="M12.4 5.6c1-2.1 2.9-3.4 5.2-3.6-.2 2.3-1.7 4.2-3.8 4.8z" {...ink('leaf')} />
    <circle cx="7.8" cy="8" r="2.7" {...ink('leafShade')} />
    <circle cx="16.2" cy="8" r="2.7" {...ink('leafShade')} />
    <circle cx="12" cy="7.2" r="3.1" {...ink('leaf')} />
    <ellipse cx="10.5" cy="5.9" rx="1.1" ry="0.7" transform="rotate(-38 10.5 5.9)" {...ink('shell')} />
    {Crate(ink, uid)}
  </>
);
