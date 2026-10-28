/* THE BESPOKE SILHOUETTES — the cast's own world.
 *
 * §7: «A specific species/cut maps to (family, form) + its name; commonest ones get bespoke
 * silhouettes over time.» These are the first ones, and they are the ones the prototype's cast
 * actually sells: the Barcelona fish counter (merluza, rape, lubina, pulpo, gamba roja), the
 * fruit that turns up in every order (mango, aguacate, tomate), and the meat side (pollo, lomo,
 * chuletón).
 *
 * A bespoke drawing has to EARN the slot — if it reads the same as its generic at 20px it is
 * costing bytes and giving nothing back. So each one carries a fact the generic cannot: the
 * hake's long second dorsal and its outsized head, the monkfish's mouth, the bass's spiny fin,
 * the octopus's arms, the prawn's antennae, the avocado's stone, the tomato's calyx, the rib bone
 * on the chuletón, the fat cap on the lomo.
 */
import * as React from 'react';
import type { Draw } from './draw';
import { Wing } from './poultry';

/* ── MERLUZA ─────────────────────────────────────────────────────────────────────────────────
 * Hake: long, slender, and mostly head. It is the single most-ordered fish on this counter, so
 * it gets the drawing that separates it from «a fish» — the big jaw, the big eye, and the low
 * second dorsal running most of the back. */
const HAKE =
  'M3.4 11.8c0-.9 1.4-1.6 4.2-2.2 3-.6 6.8-.9 9.6-.5 3.2.4 4.8 1.6 4.8 3 0 1.4-1.6 2.6-4.8 3-2.8.4-6.6.1-9.6-.5-2.8-.6-4.2-1.3-4.2-2.2z';

export const merluzaWhole: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={HAKE} />
      </clipPath>
    </defs>
    <path d="M4.6 11.8L1.4 8.2c-.4-.5-1.2-.2-1.2.5v.3l2.2 2.8-2.2 2.8v.3c0 .7.8 1 1.2.5z" {...ink('seaShade')} />
    <path d="M11.4 9.2c.9-1.5 2.2-2.4 3.6-2.6-.2 1.2-.9 2.2-1.9 3z" {...ink('seaShade')} />
    <path d="M5.2 10.6c1.8-1 3.8-1.6 5.8-1.8l-.2 1.2c-1.8.2-3.6.7-5.2 1.5z" {...ink('seaShade')} />
    <path d="M5.8 13.4c1.6.9 3.4 1.4 5.2 1.6l-.2 1.2c-2-.2-3.9-.8-5.5-1.8z" {...ink('seaShade')} />
    <path d={HAKE} {...ink('sea')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 12.8c3 1.2 6.4 1.8 10 1.8s7-.6 10-1.8V20H2z" {...ink('shell')} />
      <path d="M2 10.8c3-1.4 6.4-2.1 10-2.1s7 .7 10 2.1V4H2z" {...ink('seaShade')} />
      {/* the jaw — a hake's mouth reaches back past the eye and that is how you know it is a hake */}
      <path d="M18.2 13.4c1.4-.3 2.7-.8 3.8-1.6l.6 1.2c-1.3.9-2.7 1.5-4.2 1.8z" {...ink('seaShade')} />
    </g>
    <circle cx="19" cy="11.1" r="1.6" {...ink('shell')} />
    <circle cx="19" cy="11.1" r="0.9" {...ink('seaShade')} />
  </>
);

/* A fillet TAPERS to the tail end. The lozenge version was blunt at both ends and, being pale, it
 * read as a bread roll however much skin was on it; a point at one end is what makes it a piece
 * cut off something. */
const HAKE_FILLET =
  'M2 15.4c.4-2.6 4-5 9.2-5.9 4.3-.7 8.4-.2 10.3.9 1 .6.9 1.6-.3 2.3-3 1.9-7.7 3.6-12.2 4.3-4.4.7-7.2.2-7-1.6z';

export const merluzaFillet: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={HAKE_FILLET} />
      </clipPath>
    </defs>
    {/* hake flesh is the palest thing on the counter — paler than the generic fillet, on purpose.
     * Which is exactly why the SKIN has to be wide here: the first version was pale with three
     * scores across it and it read as a bread roll. The silver band is what makes it a fish. */}
    <path d={HAKE_FILLET} {...ink('shell')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M1 10.6c1.6 2.4 4 3.7 7.1 3.5 4.4-.3 9.7-2.4 13.9-5.4V22H1z" {...ink('sea')} />
      <path d="M1 12.6c1.6 2.4 4 3.7 7.1 3.5 4.4-.3 9.7-2.4 13.9-5.4V22H1z" {...ink('seaShade')} />
      <path d="M10.6 9.2c-.6 1.5-.9 3-.8 4.6l-1.4.3c-.1-1.9.2-3.7.9-5.3z" {...ink('shellShade')} />
      <path d="M15.4 9.2c-.6 1.4-.8 2.7-.7 4.1l-1.4.4c-.1-1.7.1-3.3.8-4.8z" {...ink('shellShade')} />
    </g>
  </>
);

/* ── GAMBA ROJA ──────────────────────────────────────────────────────────────────────────────
 * REDRAWN. The first prawn had a head shaped like two horns and legs at the wrong angle, and it
 * read as a small red reindeer. Rebuilt on the same annulus the peeled tail uses — outer 8, inner
 * 4.2, centre (11.6,12.4), open from 150° round to 260° — with the head as one wedge off the top
 * of the curl and everything else hanging where it hangs on the animal. */
const PRAWN = 'M10.2 4.5A8 8 0 1 1 4.7 16.4L8 14.5A4.2 4.2 0 1 0 10.9 8.3Z';

export const gambaRoja: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={PRAWN} />
      </clipPath>
    </defs>
    {/* the antennae, which no generic shellfish gets — a red prawn is half antenna */}
    <path d="M17.4 3.8c1.8-.8 3.6-1.1 5.4-.9" {...ink.line('deepShade', 1)} />
    <path d="M17.8 6c1.9.5 3.5 1.5 4.8 3" {...ink.line('deepShade', 1)} />
    {/* the legs */}
    <path d="M8.8 19.9l-1 2.5M12 20.4v2.6M15.1 19.5l1.1 2.4" {...ink.line('deepShade', 1)} />
    {/* the tail fan */}
    <path d="M4.7 16.4L8 14.5l.4 3.6c.1 1-1 1.7-1.9 1.2l-1.4-.8-1.8 1.6c-.8.7-2-.1-1.7-1.1z" {...ink('deepShade')} />
    <path d={PRAWN} {...ink('deep')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 15.6c4 3.8 10.6 3.6 15-.8 2.2-2.2 3.2-5 3-7.8H24v17H2z" {...ink('deepShade')} />
      {[40, 76, 112, 148].map((a) => (
        <path key={a} d="M11.2 4.1h1.5l-.3 4.5h-.9z" transform={`rotate(${a} 11.6 12.4)`} {...ink('flesh')} />
      ))}
    </g>
    {/* the head, one wedge off the top of the curl */}
    <path d="M10.2 4.5c.6-1.8 2.4-2.8 4.2-2.4l2.6.6c1.6.4 2.2 2.4 1 3.6l-7.1 2z" {...ink('deep')} />
    <circle cx="13.4" cy="4.9" r="1.1" {...ink('shell')} />
    <circle cx="13.4" cy="4.9" r="0.6" {...ink('deepShade')} />
  </>
);

/* ── PULPO ───────────────────────────────────────────────────────────────────────────────── */
const MANTLE =
  'M12 3.4c3.3 0 5.8 2.7 5.8 6.2 0 2.5-1.2 4.6-3.1 5.6H9.3c-1.9-1-3.1-3.1-3.1-5.6 0-3.5 2.5-6.2 5.8-6.2z';

export const pulpo: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={MANTLE} />
      </clipPath>
    </defs>
    {/* four arms, each curling a different way — an octopus is never symmetrical */}
    <path d="M9.2 14.8c-2.1 1.4-3.6 3.4-4.4 5.9-.3.9-1.6.7-1.6-.3 0-3 1.7-5.8 4.5-7.5z" {...ink('deep')} />
    <path d="M11 15.2c-1.1 2.1-1.5 4.3-1.2 6.5.1 1-1.2 1.3-1.5.4-.9-2.6-.6-5.2.7-7.5z" {...ink('deepShade')} />
    <path d="M13 15.2c1.1 2.1 1.5 4.3 1.2 6.5-.1 1 1.2 1.3 1.5.4.9-2.6.6-5.2-.7-7.5z" {...ink('deepShade')} />
    <path d="M14.8 14.8c2.1 1.4 3.6 3.4 4.4 5.9.3.9 1.6.7 1.6-.3 0-3-1.7-5.8-4.5-7.5z" {...ink('deep')} />
    <circle cx="6.9" cy="16.6" r="0.7" {...ink('flesh')} />
    <circle cx="5.6" cy="18.6" r="0.7" {...ink('flesh')} />
    <circle cx="17.1" cy="16.6" r="0.7" {...ink('flesh')} />
    <circle cx="18.4" cy="18.6" r="0.7" {...ink('flesh')} />
    <path d={MANTLE} {...ink('deep')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 12c3 1.6 6.4 2.4 10 2.4s7-.8 10-2.4V20H2z" {...ink('deepShade')} />
    </g>
    <ellipse cx="9.5" cy="9.6" rx="1.7" ry="1.3" {...ink('shell')} />
    <ellipse cx="14.5" cy="9.6" rx="1.7" ry="1.3" {...ink('shell')} />
    <circle cx="9.5" cy="9.6" r="0.8" {...ink('deepShade')} />
    <circle cx="14.5" cy="9.6" r="0.8" {...ink('deepShade')} />
  </>
);

/* ── RAPE ────────────────────────────────────────────────────────────────────────────────── */
const MONK =
  'M2.4 12.2c0-3.9 3.7-7 8.2-7 3.2 0 6 1.5 7.4 3.8l1.4 3.2-1.4 3.2c-1.4 2.3-4.2 3.8-7.4 3.8-4.5 0-8.2-3.1-8.2-7z';

export const rape: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={MONK} />
      </clipPath>
    </defs>
    <path d="M18.6 12.2l3.4-2.6c.5-.4 1.2 0 1.2.6v4c0 .6-.7 1-1.2.6z" {...ink('seaShade')} />
    <path d={MONK} {...ink('sea')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 9.4c2.8-2.6 6.6-3.8 10.6-3.4 2.8.3 5.2 1.4 7 3V2H2z" {...ink('seaShade')} />
      {/* THE MOUTH. A monkfish is a mouth with a fish behind it. */}
      <path d="M2.6 13.8c2.6 2.2 6.1 3.5 10 3.5 1.8 0 3.5-.3 5.1-.8l.7 1.9c-1.8.6-3.8.9-5.8.9-4.4 0-8.5-1.5-11.4-4z" {...ink('seaShade')} />
      <path d="M5.6 15.9l.9 1.6 1.3-.9zM9.6 17.2l.5 1.7 1.5-.6zM13.8 17.4l.1 1.7 1.6-.3z" {...ink('shell')} />
    </g>
    <circle cx="7.6" cy="8.8" r="1.2" {...ink('shell')} />
    <circle cx="11.2" cy="8.2" r="1.2" {...ink('shell')} />
    <circle cx="7.6" cy="8.8" r="0.6" {...ink('seaShade')} />
    <circle cx="11.2" cy="8.2" r="0.6" {...ink('seaShade')} />
  </>
);

/* ── LUBINA ──────────────────────────────────────────────────────────────────────────────── */
const BASS =
  'M21.4 12c0 .8-.6 1.6-1.8 2.4-2.6 1.8-6 2.9-9.2 2.9-3.8 0-6.2-2.1-6.2-5.3s2.4-5.3 6.2-5.3c3.2 0 6.6 1.1 9.2 2.9 1.2.8 1.8 1.6 1.8 2.4z';

export const lubina: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={BASS} />
      </clipPath>
    </defs>
    <path d="M4.8 12L1.4 8.2c-.4-.5-1.2-.2-1.2.5v.4l2.4 2.9-2.4 2.9v.4c0 .7.8 1 1.2.5z" {...ink('seaShade')} />
    {/* the spiny first dorsal — a bass wears a saw on its back */}
    <path d="M8 8.4l1.2-3.2 1 2.6 1-2.8 1 2.6 1-2.5 1.1 3v.9H8z" {...ink('seaShade')} />
    <path d="M11.6 17c1.6.3 2.9 1.2 3.7 2.6-1.8.4-3.6-.1-4.8-1.4z" {...ink('seaShade')} />
    <path d={BASS} {...ink('sea')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 13.6c3.2 1.6 6.6 2.4 10 2.4s6.8-.8 10-2.4V22H2z" {...ink('shell')} />
      <path d="M2 10.4c3.2-2 6.6-3 10-3s6.8 1 10 3V2H2z" {...ink('seaShade')} />
      <path d="M17 8.4c-1.1 2.4-1.1 5.2 0 7.6l-1.5.4c-1.2-2.7-1.2-5.7 0-8.4z" {...ink('shellShade')} />
      <path d="M6.8 12.3c3.4-.7 7-.4 10.4.9l-.3 1.1c-3.2-1.2-6.6-1.5-9.9-.8z" {...ink('shellShade')} />
    </g>
    <circle cx="18.6" cy="10.9" r="1.4" {...ink('shell')} />
    <circle cx="18.6" cy="10.9" r="0.8" {...ink('seaShade')} />
  </>
);

/* ── MANGO ───────────────────────────────────────────────────────────────────────────────── */
const MANGO =
  'M18.4 7.4c1.9 2.5 1.5 6.2-1 8.8-2.9 3-7.6 4-10.9 2.2-2.9-1.6-3.5-5.1-1.4-8 2.2-3.2 6.7-5.3 10.2-4.5 1.2.3 2.3.8 3.1 1.5z';

export const mango: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={MANGO} />
      </clipPath>
    </defs>
    <path d="M18.2 7l1.1-2.3" {...ink.line('goldShade', 1.3)} />
    <path d="M19 5.4c1.4-1.5 3.2-2 4.4-1.2-.2 1.7-1.8 3-3.6 3-.4 0-.7 0-.9-.1z" {...ink('leaf')} />
    <path d="M6.5 18.4c-1 .8-2.1 1.2-3.3 1.3.4-1.2.9-2.3 1.9-3.2z" {...ink('gold')} />
    <path d={MANGO} {...ink('gold')} />
    <g clipPath={`url(#${uid}f)`}>
      {/* THE BLUSH. It was a sliver on the shoulder and the fruit read as a lemon; a ripe mango is
        * red over half its face, so the blush takes half the face. */}
      <path d="M6 2.6c7.4 1 13 5.4 14.6 11.6L24 12V2z" {...ink('deep')} />
      <path d="M2 16c4 3.2 10.2 3.4 15-.4V22H2z" {...ink('goldShade')} />
    </g>
  </>
);

/* ── AGUACATE ────────────────────────────────────────────────────────────────────────────── */
const AVO_SKIN =
  'M12 3.4c2.3 0 4 1.8 4 4.1 0 1-.3 2-.3 2.8 0 .9 1.4 2.1 2 3.6.5 1.2.8 2.5.8 3.7 0 3.5-3 5.6-6.5 5.6s-6.5-2.1-6.5-5.6c0-1.2.3-2.5.8-3.7.6-1.5 2-2.7 2-3.6 0-.8-.3-1.8-.3-2.8 0-2.3 1.7-4.1 4-4.1z';
const AVO_FLESH =
  'M12 5.3c1.3 0 2.2 1 2.2 2.3 0 1-.3 2-.3 3 0 1.2 1.4 2.3 2 3.7.4.9.6 1.9.6 2.8 0 2.4-2 3.9-4.5 3.9s-4.5-1.5-4.5-3.9c0-.9.2-1.9.6-2.8.6-1.4 2-2.5 2-3.7 0-1-.3-2-.3-3 0-1.3.9-2.3 2.2-2.3z';

export const aguacate: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={AVO_FLESH} />
      </clipPath>
    </defs>
    <path d={AVO_SKIN} {...ink('leafShade')} />
    <path d={AVO_FLESH} {...ink('shell')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M13 4c2.6 2.4 3.6 6 3.6 9.6 0 3-.8 5.6-2.4 7.4H22V4z" {...ink('shellShade')} />
    </g>
    {/* the stone — the one shape that stops a halved avocado reading as a halved pear */}
    <circle cx="12" cy="16.2" r="2.9" {...ink('goldShade')} />
    <path d="M10 14.7c.9-1 2.2-1.4 3.5-1.1l-.5 1.5c-.9-.2-1.7.1-2.3.7z" {...ink('gold')} />
  </>
);

/* ── TOMATE ──────────────────────────────────────────────────────────────────────────────── */
const TOMATO = 'M12 6.8c4.2 0 7.5 3 7.5 7 0 4-3.3 6.9-7.5 6.9s-7.5-2.9-7.5-6.9c0-4 3.3-7 7.5-7z';

export const tomate: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={TOMATO} />
      </clipPath>
    </defs>
    <path d={TOMATO} {...ink('deep')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M13.4 5.6c3.8 1.4 6.4 4.8 6.4 8.8 0 2.4-.9 4.6-2.4 6.2H22V5.6z" {...ink('deepShade')} />
      <ellipse cx="9" cy="11.4" rx="2.1" ry="1.3" transform="rotate(-36 9 11.4)" {...ink('flesh')} />
    </g>
    {/* the calyx — five points, the way it comes off the vine */}
    <path d="M11.6 4.6h1.2l-.2 2.6h-.8z" {...ink('leafShade')} />
    <path d="M12 7.8c-2-.2-3.6-1.2-4.6-2.8 2-.5 3.7.2 4.6 1.9z" {...ink('leaf')} />
    <path d="M12 7.8c2-.2 3.6-1.2 4.6-2.8-2-.5-3.7.2-4.6 1.9z" {...ink('leaf')} />
    <path d="M11.9 7.2c-1.3-1.4-1.9-3-1.7-4.8 1.7.8 2.5 2.4 2.3 4.3z" {...ink('leaf')} />
    <path d="M12.3 7.2c1.3-1.4 1.9-3 1.7-4.8-1.7.8-2.5 2.4-2.3 4.3z" {...ink('leaf')} />
  </>
);

/* ── POLLO ───────────────────────────────────────────────────────────────────────────────── */
/* THE TRUSSED BIRD. A teardrop, not an oval: narrow at the shoulders where the neck came off,
 * heavy at the thighs. The oval version read as an onion. */
const CHICKEN =
  'M12 3.6c1.4 0 2.6.8 3.2 2 2.9 1.5 4.8 4.6 4.8 8 0 3.9-2.9 6.8-7 6.8h-2c-4.1 0-7-2.9-7-6.8 0-3.4 1.9-6.5 4.8-8 .6-1.2 1.8-2 3.2-2z';

export const polloWhole: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={CHICKEN} />
      </clipPath>
    </defs>
    {/* the two legs, tied and CROSSED — trussed, which is the whole difference from the generic
     * bird, whose legs splay out and which still has its neck */}
    <path d="M9.6 17.2l5.2 5.4M14.4 17.2l-5.2 5.4" {...ink.line('gold', 2.7)} />
    <circle cx="15.2" cy="22.8" r="1" {...ink('shell')} />
    <circle cx="8.8" cy="22.8" r="1" {...ink('shell')} />
    <path d={CHICKEN} {...ink('gold')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M3 15.4c4.8 2.8 12.6 2.6 18-1.2V22H3z" {...ink('goldShade')} />
      {/* the wing, folded against the body */}
      <path d="M6.8 10.2c-1.3 2.5-1.3 5.4 0 8l-1.7.6c-1.5-3.1-1.5-6.5 0-9.2z" {...ink('goldShade')} />
      <ellipse cx="9.8" cy="9.4" rx="2.7" ry="1.5" transform="rotate(-30 9.8 9.4)" {...ink('shell')} />
    </g>
  </>
);

/* ALITAS — a PORTION of wings, which is what the word means when it goes on an order: three of
 * them in a heap, not one.
 *
 * Two earlier tries failed here and both failed the same way. A drumette lobe with a wingette
 * hung off it fused into one L and read as a boot; pulled apart, it read as a mushroom beside a
 * tube. The lesson is that a PAIR of unlike shapes reads as neither of them, where three of the
 * SAME shape reads as a count. So the generic `poultry|wings` is a wing, and this is a portion. */
export const polloWings: Draw = (ink) => (
  <>
    <g transform="translate(1.2 1.8) scale(0.68)">
      <Wing ink={ink} tone="goldShade" />
    </g>
    <g transform="translate(9.6 4.2) scale(0.68)">
      <Wing ink={ink} tone="goldShade" />
    </g>
    <g transform="translate(4.4 9.8) scale(0.68)">
      <Wing ink={ink} tone="gold" />
    </g>
  </>
);

/* ── LOMO DE CERDO ───────────────────────────────────────────────────────────────────────── */
const LOMO =
  'M3.4 12.6c0-2.3 2.3-4.1 5.6-4.7 3.5-.6 7.4-.4 9.9.6 1.6.7 2.5 1.7 2.5 3v3.2c0 1.8-1.4 3.2-3.2 3.2H6.6c-1.8 0-3.2-1.4-3.2-3.2z';

export const lomoCerdo: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={LOMO} />
      </clipPath>
    </defs>
    <path d={LOMO} {...ink('flesh')} />
    <g clipPath={`url(#${uid}f)`}>
      {/* the fat cap, left on along the back — the cut's signature */}
      <path d="M2 12.4c1.7-2.1 4.6-3.4 7.9-3.6 3.7-.2 7.6.5 10.3 1.8V2H2z" {...ink('shell')} />
      <path d="M2 15.8c5.6 1.6 14.4 1.6 20 0V22H2z" {...ink('fleshShade')} />
      {/* the eye of the loin, on the cut end */}
      <path d="M17.6 10.6c1.5 1.1 2.3 2.4 2.3 3.8v1.6c0 1.1-.4 2.1-1.2 2.8l-1.1-1c.5-.5.8-1.1.8-1.8v-1.6c0-1-.6-1.9-1.7-2.7z" {...ink('fleshShade')} />
    </g>
  </>
);

/* ── CHULETÓN ────────────────────────────────────────────────────────────────────────────── */
const CHULETON =
  'M7.6 5.8c4.1-1.5 8.9-.4 11.1 2.5 2.2 2.9 1.2 6.8-2.3 8.8-3.9 2.2-9 1.8-11.6-1-2.5-2.7-1.4-8.6 2.8-10.3z';

export const chuleton: Draw = (ink, uid) => (
  <>
    <defs>
      <clipPath id={`${uid}f`}>
        <path d={CHULETON} />
      </clipPath>
    </defs>
    {/* the rib, still in it */}
    <path d="M5.8 16.2l11-2.8.9 2.6-11.1 3z" {...ink('shell')} />
    <circle cx="4.9" cy="17.4" r="1.9" {...ink('shell')} />
    <circle cx="5.9" cy="19.5" r="1.5" {...ink('shellShade')} />
    <path d={CHULETON} {...ink('deep')} />
    <g clipPath={`url(#${uid}f)`}>
      <path d="M2 14.4c4.8 2.8 13.6 2.4 20-1.6V22H2z" {...ink('deepShade')} />
      <path d="M8.6 8.2c2 .2 3.6 1.2 4.8 3l-1.3.9c-.9-1.4-2.1-2.2-3.7-2.4z" {...ink('shellShade')} />
      <path d="M14 7.4c1.6.2 2.9 1 3.8 2.4l-1.2.8c-.7-1.1-1.7-1.8-2.9-2z" {...ink('shellShade')} />
      <path d="M11.4 13c1.6.2 2.9 1 3.8 2.4l-1.2.8c-.7-1.1-1.7-1.8-2.9-2z" {...ink('shellShade')} />
    </g>
  </>
);
