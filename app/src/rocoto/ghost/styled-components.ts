/* GROWN from Base Web's own `src/template-component/styled-components.ts`, on the anatomy of
 * Base's `src/skeleton/styled-components.ts` (the wash idiom, the shimmer, the row loop).
 * Base Web is MIT, Copyright (c) Uber Technologies, Inc.
 *
 * EVERY value here is read from Base's theme — the greys, the spacing scale, the radii, the type
 * ramp, the motion. There are no invented numbers and no literal paint, so the whole skeleton
 * re-themes with the brand like everything else. Open any page with `?theme=proof`: the ghosts
 * take the proof brand's cast and its corners, because that is all they are made of.
 */
import { styled } from 'baseui';
import type { Theme } from 'baseui';
import { ramp as figureRamp } from '../figure';
import type { Size as FigureSize } from '../figure';
import { GEOMETRY, LINE_WIDTHS, SHIMMER, TAB_WIDTHS, WASH } from './constants';
import type { SharedStyleProps, Shape, Size, Tone } from './types';

/* ── THE GREY ─────────────────────────────────────────────────────────────────────────────── */

/** Base's mono ramp carrying the brand's ink. See `constants.ts` → WASH for why the mix exists:
 *  the mono ramp is brand-invariant, and a skeleton that does not move under the proof brand is
 *  indistinguishable from hard-coded paint. `color-mix` keeps both halves as theme tokens. */
export const wash = ($theme: Theme, tone: Tone): string => {
  const { mono, ink } = WASH[tone];
  return `color-mix(in srgb, ${$theme.colors.contentPrimary} ${ink}%, ${$theme.colors[mono]})`;
};

/** the step above a tone — the light band the shimmer sweeps through */
const lift = (tone: Tone): Tone => (tone === 'strong' ? 'default' : 'faint');

/** any CSS length; a bare number is px, the way Base's own `height`/`width` props read it */
const len = (v: string | number | undefined): string | undefined =>
  v === undefined ? undefined : typeof v === 'number' ? `${v}px` : v;

/* ── THE FILL ─────────────────────────────────────────────────────────────────────────────────
 * Two paints, one decision. A ghost is either standing for something UNDECIDED — flat wash, no
 * motion, because architecture does not load — or genuinely waiting on data, in which case Base's
 * own shimmer runs over it, with Base's own duration and curve.
 */
const fill = ($theme: Theme, tone: Tone, loading: boolean | undefined) => {
  if (!loading) return { backgroundColor: wash($theme, tone) };
  const a = wash($theme, tone);
  const b = wash($theme, lift(tone));
  return {
    backgroundImage: `linear-gradient(${SHIMMER.angle}, ${a}, ${a}, ${a}, ${a}, ${a}, ${a}, ${b}, ${a}, ${a}, ${a}, ${a}, ${a}, ${a})`,
    backgroundSize: SHIMMER.size,
    animationTimingFunction: SHIMMER.timing,
    animationDuration: SHIMMER.duration,
    animationIterationCount: 'infinite',
    animationName: {
      '0%': { backgroundPosition: '100% 50%' },
      '100%': { backgroundPosition: '0% 50%' },
    },
  };
};

/** the geometry of each shape: what it is by default, and what corner it carries */
const geometry = ($theme: Theme, shape: Shape) => {
  switch (shape) {
    case 'line':
      return {
        width: '100%',
        height: $theme.sizing[GEOMETRY.lineHeight],
        borderRadius: $theme.borders.radius100,
      };
    case 'square':
      return {
        width: $theme.sizing[GEOMETRY.squareSize],
        height: $theme.sizing[GEOMETRY.squareSize],
        borderRadius: $theme.borders.radius200,
      };
    case 'circle':
      return {
        width: $theme.sizing[GEOMETRY.circleSize],
        height: $theme.sizing[GEOMETRY.circleSize],
        borderRadius: '50%',
      };
    case 'pill':
      // radius500 exceeds the pill's own height, and CSS clamps a radius to fit — so this is a
      // true pill under any brand, and it is still the brand's corner token doing the work.
      return {
        width: $theme.sizing[GEOMETRY.pillWidth],
        height: $theme.sizing[GEOMETRY.pillHeight],
        borderRadius: $theme.borders.radius500,
      };
    case 'block':
    default:
      return {
        width: '100%',
        height: $theme.sizing[GEOMETRY.blockHeight],
        borderRadius: $theme.borders.radius300,
      };
  }
};

/** the row/list density step */
export const density = ($theme: Theme, size: Size) =>
  ({
    compact: { pad: $theme.sizing.scale300, gap: $theme.sizing.scale400, line: $theme.sizing.scale300 },
    default: { pad: $theme.sizing.scale500, gap: $theme.sizing.scale550, line: $theme.sizing.scale400 },
    large: { pad: $theme.sizing.scale600, gap: $theme.sizing.scale600, line: $theme.sizing.scale500 },
  })[size];

/** how wide the n-th ghosted line stands */
export const lineWidth = (index: number) => LINE_WIDTHS[index % LINE_WIDTHS.length];
/** how wide the n-th ghosted tab stands */
export const tabWidth = (index: number) => TAB_WIDTHS[index % TAB_WIDTHS.length];

/* ── GhostBlock ───────────────────────────────────────────────────────────────────────────────
 *
 * INERT BY CONSTRUCTION. A ghost has nothing to press, nothing to type into and nothing to
 * disable, so it takes no tab stop, swallows no pointer and holds no selection — a page of
 * negative space must never eat a keystroke meant for the one decided thing on it. When real
 * content stands inside a ghost (`children`), the Content box hands pointer events back, and the
 * real component brings Base's own focus ring with it.
 */
export const Root = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $shape, $tone, $filled, $loading, $width, $height, $grow } = props;
  const g = geometry($theme, $shape);
  return {
    boxSizing: 'border-box',
    position: 'relative',
    flexGrow: $grow ? 1 : 0,
    flexShrink: 0,
    ...g,
    ...($filled ? fill($theme, $tone, $loading) : { backgroundColor: 'transparent' }),
    width: len($width) ?? g.width,
    height: len($height) ?? ($filled ? g.height : 'auto'),
    pointerEvents: 'none',
    userSelect: 'none',
  };
});
Root.displayName = 'GhostBlock';

/** the strip the two annotations sit in: what stands here at the head, who decided it at the tail */
export const Annotations = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  position: 'absolute',
  top: $theme.sizing.scale300,
  left: $theme.sizing.scale400,
  right: $theme.sizing.scale400,
  display: 'flex',
  alignItems: 'flex-start',
  justifyContent: 'space-between',
  gap: $theme.sizing.scale300,
  pointerEvents: 'none',
}));
Annotations.displayName = 'GhostAnnotations';

/** THE WHISPER. The smallest step on the ramp, the quietest ink on it. It names the thing and
 *  stops — a sentence here would decide the region the ghost exists to leave open. */
export const Label = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.LabelXSmall,
  color: $theme.colors.contentTertiary,
  letterSpacing: '0.02em',
  whiteSpace: 'nowrap',
  overflow: 'hidden',
  textOverflow: 'ellipsis',
}));
Label.displayName = 'GhostLabel';

/** THE POINTER. The scenario that owns this region, on a chip that lifts off the wash so it stays
 *  legible on any tone. Ink, never accent: a cross-reference is the catalogue's own bookkeeping,
 *  and the accent marks the AI's act and nothing else.
 *
 *  THE GROUND IS `backgroundSecondary`, NOT `backgroundPrimary`, and that is deliberate. Under the
 *  proof brand `backgroundPrimary` resolves to the ink itself, and an ink chip carrying ink text
 *  is a chip nobody can read. `backgroundSecondary` is one of Base's neutral steps, so the chip
 *  keeps a light ground under every brand while its text, its corner and its face all move. */
export const Reference = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  ...$theme.typography.LabelXSmall,
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale100,
  flex: 'none',
  color: $theme.colors.contentPrimary,
  backgroundColor: $theme.colors.backgroundSecondary,
  boxShadow: `inset 0 0 0 1px ${$theme.colors.borderTransparent}`,
  borderRadius: $theme.borders.radius100,
  padding: `0 ${$theme.sizing.scale200}`,
  whiteSpace: 'nowrap',
}));
Reference.displayName = 'GhostReference';

/** THE NESTING SLOT. The ghost yields its ground to what is real, and gives the hand back. */
export const Content = styled<'div', SharedStyleProps>('div', () => ({
  position: 'relative',
  width: '100%',
  height: '100%',
  pointerEvents: 'auto',
  userSelect: 'auto',
}));
Content.displayName = 'GhostContent';

/* ── SURFACES AND STACKS ──────────────────────────────────────────────────────────────────────
 * The compositions are built out of GhostBlock plus these two: a paper surface with a hairline,
 * and a flex box. Nothing else. That is how one look survives fifty-eight screens.
 */

/** a paper ground with Base's hairline — a card, a nav, a header band */
export const Surface = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $divider, $variant } = props;
  const edge = `1px solid ${$theme.colors.borderTransparent}`;
  return {
    boxSizing: 'border-box',
    position: 'relative',
    backgroundColor: $theme.colors.backgroundPrimary,
    ...($divider
      ? $variant === 'bottom'
        ? { borderTop: edge }
        : { borderBottom: edge }
      : {}),
    pointerEvents: 'none',
    userSelect: 'none',
  };
});
Surface.displayName = 'GhostSurface';

/** the card ground: paper, hairline all round, Base's card corner */
export const CardRoot = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $height } = props;
  return {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    flexDirection: 'column',
    width: '100%',
    height: len($height),
    backgroundColor: $theme.colors.backgroundPrimary,
    boxShadow: `inset 0 0 0 1px ${$theme.colors.borderTransparent}`,
    borderRadius: $theme.borders.radius300,
    overflow: 'hidden',
    pointerEvents: 'none',
    userSelect: 'none',
  };
});
CardRoot.displayName = 'GhostCard';

/** the card's body — the ghosted lines and the control under the picture */
export const CardBody = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'flex-start',
  gap: density($theme, $size).gap,
  padding: $theme.sizing.scale600,
  flexGrow: 1,
}));
CardBody.displayName = 'GhostCardBody';

/** one row of a ghosted list: head, middle, tail — Base's own List Item anatomy */
export const RowRoot = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $size, $selected } = props;
  const d = density($theme, $size);
  return {
    boxSizing: 'border-box',
    /* the annotation strip is absolute, so the row must be its containing block. Without this a
       STANDALONE GhostRow with a label posts its whisper against whatever ancestor happens to be
       positioned — in a page with none, the top-left corner of the document. Every other ghost
       root is already relative; this one was the gap, and it only stayed hidden because the
       scenario shell wraps each region in a positioned Region. */
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: d.gap,
    width: '100%',
    padding: `${d.pad} ${$theme.sizing.scale600}`,
    // the row the surface is on: the faintest wash, so «this one» reads without any hue at all
    backgroundColor: $selected ? wash($theme, 'faint') : 'transparent',
    pointerEvents: 'none',
    userSelect: 'none',
  };
});
RowRoot.displayName = 'GhostRow';

/** the stack of ghosted lines in the middle of a row */
export const RowContent = styled<'div', SharedStyleProps>('div', ({ $theme, $size }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: density($theme, $size).line,
  flexGrow: 1,
  minWidth: 0,
}));
RowContent.displayName = 'GhostRowContent';

/** the list: rows, and the hairlines between them */
export const ListRoot = styled<'div', SharedStyleProps>('div', () => ({
  boxSizing: 'border-box',
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  width: '100%',
  pointerEvents: 'none',
  userSelect: 'none',
}));
ListRoot.displayName = 'GhostList';

export const Divider = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  height: '1px',
  width: '100%',
  backgroundColor: $theme.colors.borderTransparent,
}));
Divider.displayName = 'GhostDivider';

/* ── GhostTabs ────────────────────────────────────────────────────────────────────────────── */

export const TabsRoot = styled<'div', SharedStyleProps>('div', () => ({
  boxSizing: 'border-box',
  position: 'relative',
  width: '100%',
  pointerEvents: 'none',
  userSelect: 'none',
}));
TabsRoot.displayName = 'GhostTabs';

export const TabList = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'flex-end',
  gap: $theme.sizing.scale800,
  borderBottom: `1px solid ${$theme.colors.borderTransparent}`,
  paddingBottom: $theme.sizing.scale300,
}));
TabList.displayName = 'GhostTabList';

export const Tab = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'stretch',
  gap: $theme.sizing.scale300,
  paddingBottom: $theme.sizing.scale100,
}));
Tab.displayName = 'GhostTab';

/** the mark under the tab the surface is on — Base's own tab highlight, in the strong wash */
export const Highlight = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $selected } = props;
  return {
    height: $theme.sizing.scale100,
    borderRadius: $theme.borders.radius100,
    backgroundColor: $selected ? wash($theme, 'strong') : 'transparent',
  };
});
Highlight.displayName = 'GhostTabHighlight';

/* ── GhostHeader ──────────────────────────────────────────────────────────────────────────── */

export const HeaderRoot = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $divider } = props;
  return {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    alignItems: 'center',
    gap: $theme.sizing.scale600,
    width: '100%',
    padding: `${$theme.sizing.scale600} 0`,
    borderBottom: $divider ? `1px solid ${$theme.colors.borderTransparent}` : undefined,
    pointerEvents: 'none',
    userSelect: 'none',
  };
});
HeaderRoot.displayName = 'GhostHeader';

export const Titles = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  gap: $theme.sizing.scale300,
  flexGrow: 1,
  minWidth: 0,
}));
Titles.displayName = 'GhostHeaderTitles';

export const Actions = styled<'div', SharedStyleProps>('div', ({ $theme }) => ({
  display: 'flex',
  alignItems: 'center',
  gap: $theme.sizing.scale400,
  flex: 'none',
}));
Actions.displayName = 'GhostHeaderActions';

/* ── GhostNav ─────────────────────────────────────────────────────────────────────────────── */

export const NavRoot = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $variant, $width } = props;
  const edge = `1px solid ${$theme.colors.borderTransparent}`;
  const side = $variant === 'side';
  return {
    boxSizing: 'border-box',
    position: 'relative',
    display: 'flex',
    flexDirection: side ? 'column' : 'row',
    alignItems: 'stretch',
    justifyContent: side ? 'flex-start' : 'space-around',
    gap: side ? $theme.sizing.scale100 : $theme.sizing.scale400,
    width: side ? (len($width) ?? $theme.sizing.scale4800) : '100%',
    padding: side
      ? `${$theme.sizing.scale600} ${$theme.sizing.scale400}`
      : `${$theme.sizing.scale400} ${$theme.sizing.scale600}`,
    backgroundColor: $theme.colors.backgroundPrimary,
    borderRight: side ? edge : undefined,
    borderTop: side ? undefined : edge,
    pointerEvents: 'none',
    userSelect: 'none',
  };
});
NavRoot.displayName = 'GhostNav';

/** one destination. Side: icon then name, in a row. Bottom: icon over name, centred. */
export const NavItem = styled<'div', SharedStyleProps>('div', (props) => {
  const { $theme, $variant, $selected } = props;
  const side = $variant === 'side';
  return {
    boxSizing: 'border-box',
    display: 'flex',
    flexDirection: side ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: side ? 'flex-start' : 'center',
    gap: side ? $theme.sizing.scale500 : $theme.sizing.scale200,
    flexGrow: side ? 0 : 1,
    padding: side ? `${$theme.sizing.scale400} ${$theme.sizing.scale400}` : $theme.sizing.scale200,
    borderRadius: $theme.borders.radius200,
    backgroundColor: side && $selected ? wash($theme, 'faint') : 'transparent',
  };
});
NavItem.displayName = 'GhostNavItem';

/* ── GhostFigure ──────────────────────────────────────────────────────────────────────────────
 *
 * A NUMBER-SHAPED BLANK. It is sized off Figure's OWN ramp — the same typography steps the real
 * number takes — so the blank is exactly as tall as the figure that will replace it, and a
 * skeleton page does not resettle when the data lands. And the unit stub shares the blank's line,
 * because that is where a unit lives; a ghost that puts it underneath has already drawn the
 * mis-sale the rule exists to prevent.
 */
const px = (v: unknown) => parseFloat(String(v ?? 0));

export const FigureRoot = styled<'span', SharedStyleProps>('span', ({ $theme }) => ({
  position: 'relative',
  display: 'inline-flex',
  alignItems: 'center',
  gap: $theme.sizing.scale200,
  whiteSpace: 'nowrap',
  pointerEvents: 'none',
  userSelect: 'none',
}));
FigureRoot.displayName = 'GhostFigure';

/** the blank itself: as many digit-widths across as the number has digits, one type step tall */
export const FigureValue = styled<'span', SharedStyleProps & { $digits: number; $figureSize: FigureSize }>(
  'span',
  (props) => {
    const { $theme, $tone, $loading, $digits, $figureSize } = props;
    const step = $theme.typography[figureRamp($figureSize).value as keyof typeof $theme.typography];
    const size = px((step as { fontSize?: string }).fontSize);
    return {
      display: 'inline-block',
      // 0.62em is the advance width of a tabular digit in a humanist sans — the same ratio a
      // column of real figures occupies, so the blank reserves the column the number will fill
      width: `${Math.max(1, $digits) * size * 0.62}px`,
      height: `${Math.round(size * 0.74)}px`,
      borderRadius: $theme.borders.radius100,
      ...fill($theme, $tone, $loading),
    };
  }
);
FigureValue.displayName = 'GhostFigureValue';

/** the unit stub — one rung down, on the figure's own line, always */
export const FigureUnit = styled<'span', SharedStyleProps & { $figureSize: FigureSize }>('span', (props) => {
  const { $theme, $tone, $loading, $figureSize } = props;
  const step = $theme.typography[figureRamp($figureSize).sub as keyof typeof $theme.typography];
  const size = px((step as { fontSize?: string }).fontSize);
  return {
    display: 'inline-block',
    width: `${Math.round(size * 1.6)}px`,
    height: `${Math.round(size * 0.62)}px`,
    borderRadius: $theme.borders.radius100,
    ...fill($theme, $tone === 'strong' ? 'default' : 'faint', $loading),
  };
});
FigureUnit.displayName = 'GhostFigureUnit';
