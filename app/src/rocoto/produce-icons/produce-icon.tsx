/* THE PRODUCE ICON — «they feel that we understand what it is they're selling.»
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`. Base Web is MIT, Copyright (c)
 * Uber Technologies, Inc. The scaffold, the overrides contract and the prop idiom are theirs; the
 * component is Rocoto's, because Base's icon set is UI chrome — chevrons, spinners, checks — and
 * this is a picture of the customer's stock.
 *
 * WHAT IT CARRIES:
 *   · THE TAXONOMY (THE-INTELLIGENCE §7). family × form, plus an optional species. Resolution
 *     walks specific → general and cannot end empty: a species nobody has drawn still gets its
 *     family's drawing, so the column never has a hole in it.
 *   · THE STYLE. Soft 2.5D flat illustration: two or three flat tones and one shade step, rounded
 *     geometry, one 24×24 grid for all thirty-five drawings. No outlines — an outline set reads as
 *     clipart at 32px and as a grey smudge at 16px, and neither of those says «we know your
 *     goods». The shade is painted inside a clip of the silhouette, so the outline is exactly one
 *     path and there is no antialiased seam to crack open at small sizes.
 *   · THE CONTENT PALETTE, which is the one licence §7 grants against the re-theme law: these are
 *     the goods, not the brand. It lives in palette.ts, annotated line by line, and nowhere else.
 *   · `mono`. The same drawings in `currentColor` at three ink densities — for the print sheet,
 *     where there is one ink, and for any surface quiet enough that colour would shout. The
 *     drawings know nothing about it: the brush resolves the mode, so a drawing is authored once.
 *
 * ACCESSIBILITY. Untitled, the icon is `aria-hidden`, because its home is beside the product name
 * it depicts and a screen reader should not read «merluza» twice. `title` is for the rare place
 * the icon stands alone.
 */
import * as React from 'react';
import { getOverrides } from 'baseui/helpers/overrides';
import { Root as StyledRoot, Svg as StyledSvg } from './styled-components';
import { GRID, DEFAULT_FORM } from './constants';
import { makeInk } from './palette';
import { resolve } from './drawings';
import type { ProduceIconProps, SharedStyleProps } from './types';

const ProduceIcon = (props: ProduceIconProps) => {
  const {
    family,
    form,
    species,
    size = 'default',
    mono = false,
    title,
    overrides = {},
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Svg, svgProps] = getOverrides(overrides.Svg, StyledSvg);

  /* clip-path ids must be unique per INSTANCE, not per drawing: two hakes on one screen sharing
   * an id makes the second one clip against the first one's geometry, and in a list of forty
   * lines that is forty broken pictures. React's own id is stable across hydration; the colons
   * come out because a fragment reference with a colon in it is legal but nobody expects it. */
  const uid = React.useId().replace(/:/g, '');

  const ink = React.useMemo(() => makeInk(mono), [mono]);
  const { draw, form: drawn } = resolve(family, form, species);

  const shared: SharedStyleProps = {
    $size: size,
    $mono: mono,
    $family: family,
    $form: form ?? DEFAULT_FORM[family],
  };

  return (
    <Root data-baseweb="produce-icon" data-family={family} data-form={drawn} {...shared} {...rootProps}>
      <Svg
        viewBox={`0 0 ${GRID} ${GRID}`}
        role={title ? 'img' : undefined}
        aria-hidden={title ? undefined : true}
        focusable="false"
        {...shared}
        {...svgProps}
      >
        {title && <title>{title}</title>}
        {draw(ink, uid)}
      </Svg>
    </Root>
  );
};

export default ProduceIcon;
