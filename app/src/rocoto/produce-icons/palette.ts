/* THE CONTENT PALETTE — the one file in this system that owns colour outside the theme.
 *
 * THE-INTELLIGENCE §7 grants it explicitly: these icons are IMAGERY OF THE CUSTOMER'S GOODS, not
 * UI chrome. A hake is silver, a sirloin is red, a lettuce is green — those are facts about the
 * stock, not decisions about the brand, and re-hueing them onto ink would produce eight identical
 * grey blobs and destroy the only thing the icons are for: «they feel that we understand what it
 * is they're selling.» So the palette is held here, in ONE file, every value annotated, and
 * nowhere else. `?theme=proof` moves the chrome around these icons; the goods stay the colour the
 * goods are.
 *
 * IT IS SIX HUES, EACH WITH ONE SHADE STEP — twelve values, and the pairing is the point. §7 asks
 * for «two or three flat tones per icon with one soft shade step», so a tone and its shade are
 * authored as a pair and every drawing takes a base, its shade, and at most one accent. A palette
 * of free-floating tints would let thirty-five drawings drift apart; a palette of pairs cannot.
 *
 * THEY ARE ALL DESATURATED. Saffron sits at 75% saturation; the reddest value here is 39%, and
 * browner. On paper the icons read as goods and the saffron mark still reads as the AI's own act,
 * because nothing in a row of produce competes with it. Checked against ink too: the darkest
 * value here is far lighter than the ink, so an icon never reads as text.
 *
 * DEPTH is what makes `mono` possible. Each value carries where it sits in the light-to-dark
 * order; in single-ink rendering the hue is dropped and the depth becomes an ink density. So a
 * drawing is authored ONCE and prints in one colour without a second set of paths.
 */

/** how dark a value is, in the three steps a flat 2.5D drawing uses: lit face · body · shade */
export type Depth = 0 | 1 | 2;

export type Tone = keyof typeof PALETTE;

export const PALETTE = {
  /* FLESH — cut fish and pale meat: hake off the bone, pork, prawn tails. */
  flesh: { hex: '#E5B7A2', depth: 0 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)
  fleshShade: { hex: '#CB9078', depth: 1 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)

  /* SHELL — the pale things: bone, fat, cream, a fish's belly, a scallop, cheese rind, sacking. */
  shell: { hex: '#EDE2CE', depth: 0 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)
  shellShade: { hex: '#D5C4A5', depth: 1 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)

  /* LEAF — everything green: tops, herbs, leaves, avocado skin. Olive, never salad-bar green. */
  leaf: { hex: '#95A26F', depth: 1 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)
  leafShade: { hex: '#6E7C50', depth: 2 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)

  /* GOLD — chicken skin, ripe fruit, cheese, grain, the crate. */
  gold: { hex: '#D2A557', depth: 1 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)
  goldShade: { hex: '#A87A33', depth: 2 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)

  /* SEA — silver skin, wet stone, the cold end of the counter. */
  sea: { hex: '#8E9BA6', depth: 1 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)
  seaShade: { hex: '#64717E', depth: 2 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)

  /* DEEP — red meat, a cooked octopus, a red prawn, a tomato. Brick, held well off saffron. */
  deep: { hex: '#AC5C4C', depth: 1 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)
  deepShade: { hex: '#82403A', depth: 2 as Depth }, // theme-gate-allow: produce-icon content palette (THE-INTELLIGENCE §7)
} as const;

/** THE SINGLE-INK RAMP. `mono` prints every drawing in `currentColor` at three densities, so the
 *  icon takes the ink of whatever it sits in — the albarán sheet, a quiet row, a disabled line.
 *  The steps are far enough apart that the 2.5D form survives at 16px on paper: a lit face, a
 *  body, and a shade, which is exactly the three-step structure the colour drawings already have.
 *
 *  The lightest step was 0.18 and it disappeared on white — a shell-toned drawing lost its whole
 *  body and kept only its shade, so the fan shell printed as half a fan. 0.24 is the point where
 *  the lit face still reads as lighter than the body but is unmistakably there. */
export const MONO_ALPHA: Record<Depth, number> = { 0: 0.24, 1: 0.5, 2: 0.85 };

/** the paint a drawing asks for, resolved for the mode it is rendering in */
export type Paint = { fill: string; fillOpacity?: number };
export type Stroke = {
  stroke: string;
  strokeOpacity?: number;
  strokeWidth: number;
  strokeLinecap: 'round';
  strokeLinejoin: 'round';
  fill: 'none';
};

/** the brush handed to every drawing: `ink('sea')` fills, `ink.line('sea', 2)` draws a tube.
 *  Drawings never see a hex and never see the mode — that is the whole reason thirty-five
 *  drawings need no `mono` branch anywhere in them. */
export type Ink = ((tone: Tone) => Paint) & {
  line: (tone: Tone, width: number) => Stroke;
};

export function makeInk(mono: boolean): Ink {
  const paint = (tone: Tone): Paint => {
    const t = PALETTE[tone];
    return mono
      ? { fill: 'currentColor', fillOpacity: MONO_ALPHA[t.depth] }
      : { fill: t.hex };
  };
  const ink = paint as Ink;
  ink.line = (tone: Tone, width: number): Stroke => {
    const t = PALETTE[tone];
    return {
      stroke: mono ? 'currentColor' : t.hex,
      ...(mono ? { strokeOpacity: MONO_ALPHA[t.depth] } : {}),
      strokeWidth: width,
      strokeLinecap: 'round',
      strokeLinejoin: 'round',
      fill: 'none',
    };
  };
  return ink;
}

/** the palette in reading order, for the kit page's swatch row */
export const TONES = Object.keys(PALETTE) as Tone[];
