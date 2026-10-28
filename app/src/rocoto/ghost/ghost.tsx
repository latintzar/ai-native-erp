/* GHOST — the structured-skeleton vocabulary.
 *
 * GROWN from Base Web's own `src/template-component/component.tsx`, on the anatomy of Base's
 * `src/skeleton/`. Base Web is MIT, Copyright (c) Uber Technologies, Inc. The scaffold, the
 * overrides contract and the prop idiom are theirs; the component is Rocoto's, because Base ships
 * a skeleton that means LOADING and this product needs one that means UNDECIDED.
 *
 * WHAT IT IS FOR
 *   A scenario screen draws exactly one thing at full fidelity: the situation it decides. The rest
 *   of the screen — the tabs it sits under, the cards beside it, the nav around it — is drawn in
 *   Ghost. Grey shapes, no data, no sentences, and structurally honest: «there will be some kind of
 *   cards here, about four of them, with a picture and two lines each» renders as four card shapes
 *   with a picture region and two lines. The negative space still has a UI. It is architecture,
 *   not void.
 *
 * WHY IT HAS TO BE A COMPONENT FAMILY AND NOT A HABIT
 *   A scenario that draws its context in detail has silently DECIDED that context — which is some
 *   other scenario's subject, or nobody's yet. One shared vocabulary is what keeps fifty-eight
 *   screens honest about the boundary of what they know, and it is why a scenario never invents
 *   its own grey.
 *
 * THE TWO MARKS
 *   `label` whispers what stands in a region. `reference` points at the scenario that decides it.
 *   Together they turn the catalogue into a web: every grey area either names its owner or is
 *   openly open. Openness is explicit, never implied.
 *
 * NO ANIMATION
 *   The skeleton here means undecided, so nothing shimmers. `loading` is the narrow exception, for
 *   a surface genuinely waiting on data; it runs Base's own shimmer, with Base's own numbers.
 *
 * INERT
 *   There is no focus, no key handling and no disabled state to ship here, and that is the
 *   complete state matrix rather than a gap in it: a ghost takes no tab stop, swallows no pointer
 *   and holds no selection, so a page of negative space can never eat a keystroke meant for the
 *   one decided thing on it. Where real content stands inside a ghost, the ghost hands the hand
 *   back and the real component brings Base's own focus ring with it.
 */
import * as React from 'react';
import { useStyletron } from 'baseui';
import { getOverrides } from 'baseui/helpers/overrides';
import { ACTION_WIDTHS } from './constants';
import {
  Root as StyledRoot,
  Annotations as StyledAnnotations,
  Label as StyledLabel,
  Reference as StyledReference,
  Content as StyledContent,
  CardRoot as StyledCardRoot,
  CardBody as StyledCardBody,
  RowRoot as StyledRowRoot,
  RowContent as StyledRowContent,
  ListRoot as StyledListRoot,
  Divider as StyledDivider,
  TabsRoot as StyledTabsRoot,
  TabList as StyledTabList,
  Tab as StyledTab,
  Highlight as StyledHighlight,
  HeaderRoot as StyledHeaderRoot,
  Titles as StyledTitles,
  Actions as StyledActions,
  NavRoot as StyledNavRoot,
  NavItem as StyledNavItem,
  FigureRoot as StyledFigureRoot,
  FigureValue as StyledFigureValue,
  FigureUnit as StyledFigureUnit,
  lineWidth,
  tabWidth,
} from './styled-components';
import type {
  GhostAnnotationOverrides,
  GhostAvatarProps,
  GhostBlockProps,
  GhostCardProps,
  GhostFigureProps,
  GhostHeaderProps,
  GhostListProps,
  GhostNavProps,
  GhostRowProps,
  GhostTabsProps,
  SharedStyleProps,
  Size,
} from './types';

/* ── SHARED INTERNALS ─────────────────────────────────────────────────────────────────────── */

const times = (n: number) => Array.from({ length: Math.max(0, n) }, (_, i) => i);

const base = (over: Partial<SharedStyleProps> = {}): SharedStyleProps => ({
  $shape: 'block',
  $tone: 'default',
  $size: 'default',
  $filled: true,
  $loading: false,
  ...over,
});

type A11y = {
  'aria-hidden'?: true;
  role?: 'img' | 'presentation';
  'aria-label'?: string;
  'aria-busy'?: true;
};

/** A ghost names nothing, so by default it says nothing: it is hidden from assistive technology
 *  entirely. Give it an `aria-label` and it becomes an image with that name. Give it real content
 *  and it steps out of the way, because the content speaks for itself — an `aria-hidden` root
 *  would silence the one decided thing on the page. */
const a11y = (ariaLabel: string | undefined, hasContent: boolean, loading?: boolean): A11y => {
  if (ariaLabel) {
    return { role: 'img', 'aria-label': ariaLabel, ...(loading ? { 'aria-busy': true as const } : {}) };
  }
  if (hasContent) return {};
  return { 'aria-hidden': true, role: 'presentation' };
};

/** the annotation strip, shared by every composition that can carry one */
const Marks = ({
  label,
  reference,
  shared,
  overrides,
}: {
  label?: React.ReactNode;
  reference?: React.ReactNode;
  shared: SharedStyleProps;
  overrides: GhostAnnotationOverrides;
}) => {
  const [Annotations, annotationsProps] = getOverrides(overrides.Annotations, StyledAnnotations);
  const [Label, labelProps] = getOverrides(overrides.Label, StyledLabel);
  const [Reference, referenceProps] = getOverrides(overrides.Reference, StyledReference);
  if (label === undefined && reference === undefined) return null;
  return (
    <Annotations {...shared} {...annotationsProps}>
      {label !== undefined ? (
        <Label {...shared} {...labelProps}>
          {label}
        </Label>
      ) : (
        <span />
      )}
      {reference !== undefined ? (
        <Reference {...shared} {...referenceProps}>
          <span aria-hidden="true">&rarr;</span>
          {reference}
        </Reference>
      ) : null}
    </Annotations>
  );
};

/* ── GhostBlock — THE PRIMITIVE ───────────────────────────────────────────────────────────────
 * Every other member of this family is built out of this one, which is the whole point: there is
 * one place a grey is chosen, one place a corner is chosen, and one place a region can be named.
 */
export const GhostBlock = (props: GhostBlockProps) => {
  const {
    shape = 'block',
    tone = 'default',
    width,
    height,
    grow = false,
    label,
    reference,
    loading = false,
    children,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const [Content, contentProps] = getOverrides(overrides.Content, StyledContent);

  const hasContent = children !== undefined && children !== null;
  const shared = base({
    $shape: shape,
    $tone: tone,
    $filled: !hasContent,
    $loading: loading,
    $width: width,
    $height: height,
    $grow: grow,
  });

  return (
    <Root data-baseweb="ghost-block" {...a11y(ariaLabel, hasContent, loading)} {...shared} {...rootProps}>
      {hasContent ? (
        <Content {...shared} {...contentProps}>
          {children}
        </Content>
      ) : null}
      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};

/* ── GhostAvatar ──────────────────────────────────────────────────────────────────────────────
 * A person, unnamed. The three sizes are Base's own steps, so a ghosted row and a real one line up
 * on the same baseline.
 */
const AVATAR_SIZE: Record<Size, 'scale800' | 'scale1000' | 'scale1200'> = {
  compact: 'scale800',
  default: 'scale1000',
  large: 'scale1200',
};

export const GhostAvatar = (props: GhostAvatarProps) => {
  const { size = 'default', tone = 'default', label, reference, loading = false, overrides = {}, 'aria-label': ariaLabel } = props;
  const [, theme] = useStyletron();
  const [Root, rootProps] = getOverrides(overrides.Root, StyledRoot);
  const shared = base({ $shape: 'circle', $tone: tone, $size: size, $loading: loading });
  const d = theme.sizing[AVATAR_SIZE[size]];
  return (
    <Root
      data-baseweb="ghost-avatar"
      {...a11y(ariaLabel, false, loading)}
      {...shared}
      $width={d}
      $height={d}
      {...rootProps}
    >
      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};

/* ── GhostFigure ──────────────────────────────────────────────────────────────────────────────
 * A number-shaped blank, sized on Figure's own ramp — see `styled-components.ts`. The unit stub
 * shares its line, always.
 */
export const GhostFigure = (props: GhostFigureProps) => {
  const {
    digits = 4,
    unit = false,
    size = 'default',
    tone = 'default',
    label,
    reference,
    loading = false,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledFigureRoot);
  const [Value, valueProps] = getOverrides(overrides.Value, StyledFigureValue);
  const [Unit, unitProps] = getOverrides(overrides.Unit, StyledFigureUnit);
  const shared = base({ $tone: tone, $loading: loading });

  return (
    <Root data-baseweb="ghost-figure" {...a11y(ariaLabel, false, loading)} {...shared} {...rootProps}>
      <Value {...shared} $digits={digits} $figureSize={size} {...valueProps} />
      {unit ? <Unit {...shared} $figureSize={size} {...unitProps} /> : null}
      <Marks label={label} reference={reference} shared={shared} overrides={{}} />
    </Root>
  );
};

/* ── GhostRow ─────────────────────────────────────────────────────────────────────────────────
 * Base's own List Item anatomy, emptied: head, middle, tail. The first line reads heavier than the
 * ones under it, because that is what a title does — the ghost keeps the hierarchy even though it
 * has dropped the words.
 */
export const GhostRow = (props: GhostRowProps) => {
  const {
    leading = 'none',
    lines = 2,
    trailing = 'none',
    size = 'default',
    selected = false,
    index = 0,
    label,
    reference,
    loading = false,
    children,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [, theme] = useStyletron();
  const [Root, rootProps] = getOverrides(overrides.Root, StyledRowRoot);
  const [Leading, leadingProps] = getOverrides(overrides.Leading, StyledRoot);
  const [Content, contentProps] = getOverrides(overrides.Content, StyledRowContent);
  const [Line, lineProps] = getOverrides(overrides.Line, StyledRoot);
  const [Trailing, trailingProps] = getOverrides(overrides.Trailing, StyledRoot);

  const hasContent = children !== undefined && children !== null;
  const shared = base({ $size: size, $loading: loading, $selected: selected });
  const lineHeight = theme.sizing[size === 'compact' ? 'scale300' : size === 'large' ? 'scale500' : 'scale400'];

  return (
    <Root data-baseweb="ghost-row" {...a11y(ariaLabel, hasContent, loading)} {...shared} {...rootProps}>
      {leading !== 'none' ? (
        <Leading
          {...shared}
          $shape={leading === 'avatar' ? 'circle' : 'square'}
          $tone={selected ? 'strong' : 'default'}
          {...leadingProps}
        />
      ) : null}

      {hasContent ? (
        <Content {...shared} {...contentProps}>
          {children}
        </Content>
      ) : (
        <Content {...shared} {...contentProps}>
          {times(lines).map((i) => (
            <Line
              key={i}
              {...shared}
              $shape="line"
              $tone={i === 0 ? (selected ? 'strong' : 'default') : 'faint'}
              // the row's own place is folded into the cycle, so five stacked rows read as five
              // different sentences rather than as five copies of one
              $width={lineWidth(index * 2 + i)}
              $height={i === 0 ? lineHeight : theme.sizing.scale300}
              {...lineProps}
            />
          ))}
        </Content>
      )}

      {trailing === 'figure' ? (
        <GhostFigure size={size === 'large' ? 'default' : 'compact'} digits={4} unit loading={loading} />
      ) : trailing === 'control' ? (
        <Trailing {...shared} $shape="pill" $width={theme.sizing.scale1600} {...trailingProps} />
      ) : null}

      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};

/* ── GhostList ────────────────────────────────────────────────────────────────────────────────
 * n rows. The COUNT is the honest part: a region that will hold about five things renders about
 * five things, and a scenario that shows three when the real screen holds thirty has quietly
 * decided the density.
 */
export const GhostList = (props: GhostListProps) => {
  const {
    rows = 4,
    selected,
    divider = true,
    leading = 'none',
    lines = 2,
    trailing = 'none',
    size = 'default',
    label,
    reference,
    loading = false,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [Root, rootProps] = getOverrides(overrides.Root, StyledListRoot);
  const [Divider, dividerProps] = getOverrides(overrides.Divider, StyledDivider);
  const shared = base({ $size: size, $loading: loading });

  return (
    <Root data-baseweb="ghost-list" {...a11y(ariaLabel, false, loading)} {...shared} {...rootProps}>
      {times(rows).map((i) => (
        <React.Fragment key={i}>
          <GhostRow
            leading={leading}
            lines={lines}
            trailing={trailing}
            size={size}
            index={i}
            selected={selected === i}
            loading={loading}
            overrides={overrides.Row}
          />
          {divider && i < rows - 1 ? <Divider {...shared} {...dividerProps} /> : null}
        </React.Fragment>
      ))}
      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};

/* ── GhostCard ────────────────────────────────────────────────────────────────────────────────
 * The shape a card takes before anybody has decided what is on it: a picture region, a title, some
 * lines, a control. Paper ground and Base's hairline, so a wall of these still reads as cards.
 */
export const GhostCard = (props: GhostCardProps) => {
  const {
    media = false,
    lines = 2,
    action = false,
    height,
    label,
    reference,
    loading = false,
    children,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [, theme] = useStyletron();
  const [Root, rootProps] = getOverrides(overrides.Root, StyledCardRoot);
  const [Media, mediaProps] = getOverrides(overrides.Media, StyledRoot);
  const [Body, bodyProps] = getOverrides(overrides.Body, StyledCardBody);
  const [Title, titleProps] = getOverrides(overrides.Title, StyledRoot);
  const [Line, lineProps] = getOverrides(overrides.Line, StyledRoot);
  const [Action, actionProps] = getOverrides(overrides.Action, StyledRoot);
  const [Content, contentProps] = getOverrides(overrides.Content, StyledContent);

  const hasContent = children !== undefined && children !== null;
  // $height stays OFF the shared object: it is spread into every shape inside the card, and a
  // card's own height is not the height of the lines in it.
  const shared = base({ $loading: loading });

  return (
    <Root
      data-baseweb="ghost-card"
      {...a11y(ariaLabel, hasContent, loading)}
      {...shared}
      $height={height}
      {...rootProps}
    >
      {media ? (
        <Media {...shared} $shape="block" $tone="default" $height={theme.sizing.scale2400} {...mediaProps} />
      ) : null}

      {hasContent ? (
        <Content {...shared} {...contentProps}>
          {children}
        </Content>
      ) : (
        <Body {...shared} {...bodyProps}>
          <Title {...shared} $shape="line" $tone="strong" $width="58%" $height={theme.sizing.scale500} {...titleProps} />
          {times(lines).map((i) => (
            <Line key={i} {...shared} $shape="line" $tone="faint" $width={lineWidth(i)} {...lineProps} />
          ))}
          {action ? (
            <Action {...shared} $shape="pill" $tone="default" $width={theme.sizing.scale1600} {...actionProps} />
          ) : null}
        </Body>
      )}

      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};

/* ── GhostTabs ────────────────────────────────────────────────────────────────────────────────
 * How many ways this surface divides, and which one it is on. Nothing about what they are called.
 * The tab the surface is on carries Base's own highlight, in the strong wash — never in ink and
 * never in the accent, which marks the AI's act and nothing else.
 */
export const GhostTabs = (props: GhostTabsProps) => {
  const {
    tabs = 3,
    selected = 0,
    label,
    reference,
    loading = false,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [, theme] = useStyletron();
  const [Root, rootProps] = getOverrides(overrides.Root, StyledTabsRoot);
  const [TabList, tabListProps] = getOverrides(overrides.TabList, StyledTabList);
  const [Tab, tabProps] = getOverrides(overrides.Tab, StyledTab);
  const [Highlight, highlightProps] = getOverrides(overrides.Highlight, StyledHighlight);
  const shared = base({ $loading: loading });

  return (
    <Root data-baseweb="ghost-tabs" {...a11y(ariaLabel, false, loading)} {...shared} {...rootProps}>
      <TabList {...shared} {...tabListProps}>
        {times(tabs).map((i) => (
          <Tab key={i} {...shared} $index={i} $selected={i === selected} {...tabProps}>
            <GhostBlock
              shape="line"
              tone={i === selected ? 'strong' : 'default'}
              width={tabWidth(i)}
              height={theme.sizing.scale400}
              loading={loading}
            />
            <Highlight {...shared} $index={i} $selected={i === selected} {...highlightProps} />
          </Tab>
        ))}
      </TabList>
      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};

/* ── GhostHeader ──────────────────────────────────────────────────────────────────────────────
 * The band at the top of a screen: where it came from, what it is called, what can be done to it.
 * The controls are three different widths on purpose — a header whose controls are all one width
 * reads as a diagram of a header rather than a header.
 */
export const GhostHeader = (props: GhostHeaderProps) => {
  const {
    back = false,
    subtitle = false,
    actions = 0,
    divider = true,
    label,
    reference,
    loading = false,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [, theme] = useStyletron();
  const [Root, rootProps] = getOverrides(overrides.Root, StyledHeaderRoot);
  const [Back, backProps] = getOverrides(overrides.Back, StyledRoot);
  const [Titles, titlesProps] = getOverrides(overrides.Titles, StyledTitles);
  const [Title, titleProps] = getOverrides(overrides.Title, StyledRoot);
  const [Subtitle, subtitleProps] = getOverrides(overrides.Subtitle, StyledRoot);
  const [Actions, actionsProps] = getOverrides(overrides.Actions, StyledActions);
  const [Action, actionProps] = getOverrides(overrides.Action, StyledRoot);
  const shared = base({ $loading: loading, $divider: divider });

  return (
    <Root data-baseweb="ghost-header" {...a11y(ariaLabel, false, loading)} {...shared} {...rootProps}>
      {back ? <Back {...shared} $shape="square" $tone="default" {...backProps} /> : null}
      <Titles {...shared} {...titlesProps}>
        <Title {...shared} $shape="line" $tone="strong" $width="42%" $height={theme.sizing.scale550} {...titleProps} />
        {subtitle ? (
          <Subtitle {...shared} $shape="line" $tone="faint" $width="26%" $height={theme.sizing.scale300} {...subtitleProps} />
        ) : null}
      </Titles>
      {actions > 0 ? (
        <Actions {...shared} {...actionsProps}>
          {times(actions).map((i) => (
            <Action
              key={i}
              {...shared}
              $shape="pill"
              $tone="default"
              $width={ACTION_WIDTHS[i % ACTION_WIDTHS.length]}
              {...actionProps}
            />
          ))}
        </Actions>
      ) : null}
      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};

/* ── GhostNav ─────────────────────────────────────────────────────────────────────────────────
 * The two frames the catalogue draws in: a desk rail down the left, a phone bar across the bottom.
 * Same vocabulary, same greys, one variant apart — which is the reduction the puzzle is looking
 * for, showing up early in the skeleton.
 */
export const GhostNav = (props: GhostNavProps) => {
  const {
    variant = 'side',
    items = 5,
    selected = 0,
    brand = false,
    width,
    label,
    reference,
    loading = false,
    overrides = {},
    'aria-label': ariaLabel,
  } = props;

  const [, theme] = useStyletron();
  const [Root, rootProps] = getOverrides(overrides.Root, StyledNavRoot);
  const [Brand, brandProps] = getOverrides(overrides.Brand, StyledRoot);
  const [Item, itemProps] = getOverrides(overrides.Item, StyledNavItem);
  const [Icon, iconProps] = getOverrides(overrides.Icon, StyledRoot);
  const [Line, lineProps] = getOverrides(overrides.Line, StyledRoot);

  const side = variant === 'side';
  // $width stays OFF the shared object, for the same reason as the card's height: the rail is
  // 220px wide, and the icons standing in it are not.
  const shared = base({ $loading: loading, $variant: variant });

  return (
    <Root
      data-baseweb="ghost-nav"
      {...a11y(ariaLabel, false, loading)}
      {...shared}
      $width={width}
      {...rootProps}
    >
      {side && brand ? (
        <Brand
          {...shared}
          $shape="line"
          $tone="strong"
          $width="60%"
          $height={theme.sizing.scale550}
          {...brandProps}
        />
      ) : null}
      {times(items).map((i) => (
        <Item key={i} {...shared} $index={i} $selected={i === selected} {...itemProps}>
          <Icon
            {...shared}
            $shape="square"
            $tone={i === selected ? 'strong' : 'default'}
            {...iconProps}
          />
          <Line
            {...shared}
            $shape="line"
            $tone={i === selected ? 'default' : 'faint'}
            $width={side ? lineWidth(i) : theme.sizing.scale900}
            $height={theme.sizing.scale300}
            $grow={side}
            {...lineProps}
          />
        </Item>
      ))}
      <Marks label={label} reference={reference} shared={shared} overrides={overrides} />
    </Root>
  );
};
