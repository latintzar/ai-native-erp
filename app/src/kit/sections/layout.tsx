/* LAYOUT — Base Web's layout primitives, demonstrated by Base's own docs examples.
 *
 * Every example file under bw-docs/examples/{layout-grid,flex-grid,aspect-ratio-box,layer,
 * page-control,tile,list} ships here as one Tile. The example code AND its copy are Uber's,
 * verbatim. The edits are structural only: docs-site-local imports -> chrome, collision-free
 * component names, type shims for this app's React version, and theme tokens where an example
 * hard-coded a colour.
 *
 * This kit is grammar, not sentences. Which control serves which moment of the product is a
 * decision for the situations catalogue, made there and made explicitly — so nothing here is
 * dressed in product content that would pre-empt it.
 */
import * as React from 'react';
import { Section, Tile as KitTile, Grid as KitGrid } from '../chrome';
import { useStyletron, LightTheme } from 'baseui';

import { Grid, Cell, ALIGNMENT, BEHAVIOR, STYLE } from 'baseui/layout-grid';
import { FlexGrid, FlexGridItem } from 'baseui/flex-grid';
import type { BlockProps } from 'baseui/block';
import { AspectRatioBox, AspectRatioBoxBody } from 'baseui/aspect-ratio-box';
import {
  Layer,
  LayersManager as BaseLayersManager,
  TetherBehavior as BaseTetherBehavior,
  TETHER_PLACEMENT,
} from 'baseui/layer';
import { PageControl, KIND as PAGE_CONTROL_KIND } from 'baseui/page-control';
import { Tile, TileGroup, TILE_KIND, TILE_GROUP_KIND, ALIGNMENT as TILE_ALIGNMENT } from 'baseui/tile';
import { ListItem, ListItemLabel, ListHeading, MenuAdapter, ARTWORK_SIZES } from 'baseui/list';
import { StatefulMenu } from 'baseui/menu';
import { Button, KIND, SIZE, SHAPE } from 'baseui/button';
import { Check as BaseCheck, ChevronLeft, ChevronRight, Search as BaseSearch } from 'baseui/icon';
import Calendar from 'baseui/icon/calendar';
import Upload from 'baseui/icon/upload';

/* baseui@16.1.1 carries a nested @types/react@16 beside its own declarations, so its two CLASS
 * components — TetherBehavior and LayersManager — type-check as React 16 elements against this
 * app's React 18 types and tsc rejects them in JSX. Runtime is unaffected; this is a duplicate-
 * @types artefact, not a behaviour difference. Re-typed here so the JSX below stays Uber's. */
const TetherBehavior = BaseTetherBehavior as unknown as React.ComponentType<any>;
const LayersManager = BaseLayersManager as unknown as React.ComponentType<any>;

/* Same shape of upstream looseness in baseui/list: `ListProps.artwork` is typed as a plain
 * ComponentType, but every icon baseui ships is a forwardRef component, so Uber's own example
 * (`artwork={Search}`) does not satisfy its own type. The icons ARE the intended value — widened
 * once here so the JSX below stays theirs. */
const Search = BaseSearch as typeof BaseSearch & React.ComponentType<any>;
const Check = BaseCheck as typeof BaseCheck & React.ComponentType<any>;

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * LAYOUT GRID
 * Thirteen examples, one pair of helpers. Every layout-grid example in the docs declares an
 * identical `Outer`/`Inner` pair; they are folded into one here (align.tsx's `h` prop kept as the
 * optional case) so the thirteen demos below are Uber's code with nothing else changed.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const GridOuter: React.FC<{ children?: React.ReactNode }> = ({ children }) => {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        background: theme.colors.accent100,
      })}
    >
      {children}
    </div>
  );
};

const GridInner: React.FC<{ h?: number; children?: React.ReactNode }> = ({ children, h }) => {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        display: 'flex',
        justifyContent: 'center',
        alignItems: 'center',
        background: theme.colors.accent200,
        color: theme.colors.accent700,
        padding: '.25rem',
        ...(h ? { height: h + 'px' } : {}),
      })}
    >
      {children}
    </div>
  );
};

function LayoutGridBasicExample() {
  return (
    <GridOuter>
      <Grid>
        <Cell>
          <GridInner>1</GridInner>
        </Cell>
        <Cell>
          <GridInner>2</GridInner>
        </Cell>
        <Cell>
          <GridInner>3</GridInner>
        </Cell>
        <Cell>
          <GridInner>4</GridInner>
        </Cell>
        <Cell>
          <GridInner>5</GridInner>
        </Cell>
        <Cell>
          <GridInner>6</GridInner>
        </Cell>
        <Cell>
          <GridInner>7</GridInner>
        </Cell>
        <Cell>
          <GridInner>8</GridInner>
        </Cell>
        <Cell>
          <GridInner>9</GridInner>
        </Cell>
        <Cell>
          <GridInner>10</GridInner>
        </Cell>
        <Cell>
          <GridInner>11</GridInner>
        </Cell>
        <Cell>
          <GridInner>12</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridSpanExample() {
  return (
    <GridOuter>
      <Grid>
        <Cell span={2}>
          <GridInner>1</GridInner>
        </Cell>
        <Cell span={2}>
          <GridInner>2</GridInner>
        </Cell>
        <Cell span={2}>
          <GridInner>3</GridInner>
        </Cell>
        <Cell span={2}>
          <GridInner>4</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridResponsiveExample() {
  return (
    <GridOuter>
      <Grid>
        <Cell span={[1, 2, 3]}>
          <GridInner>1</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>2</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>3</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>4</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridHideExample() {
  return (
    <GridOuter>
      <Grid>
        <Cell span={[1, 0]}>
          <GridInner>1</GridInner>
        </Cell>
        <Cell span={[1, 4, 6]}>
          <GridInner>2</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>3</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>4</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridSkipExample() {
  return (
    <GridOuter>
      <Grid>
        <Cell span={2}>
          <GridInner>1</GridInner>
        </Cell>
        <Cell skip={[1, 4, 7]} span={[1, 2, 3]}>
          <GridInner>2</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridSkipShrinkExample() {
  return (
    <GridOuter>
      <Grid>
        <Cell skip={1} span={[4, 8, 12]}>
          <GridInner>1</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridAlignExample() {
  return (
    <GridOuter>
      <Grid align={ALIGNMENT.center}>
        <Cell span={[1, 2, 3]}>
          <GridInner h={28}>1</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner h={52}>2</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner h={34}>3</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridOrderExample() {
  return (
    <GridOuter>
      <Grid>
        <Cell order={1} span={[1, 2, 3]}>
          <GridInner>1</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>2</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>3</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridBehaviorExample() {
  return (
    <GridOuter>
      <Grid behavior={BEHAVIOR.fluid}>
        <Cell span={12}>
          <GridInner>1</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridCustomExample() {
  return (
    <GridOuter>
      <Grid
        gridColumns={12}
        gridGaps={[2, 6, 12]}
        gridGutters={[2, 6, 12]}
        gridMargins={[8, 16, 32]}
        gridMaxWidth={1440}
      >
        <Cell>
          <GridInner>1</GridInner>
        </Cell>
        <Cell>
          <GridInner>2</GridInner>
        </Cell>
        <Cell>
          <GridInner>3</GridInner>
        </Cell>
        <Cell>
          <GridInner>4</GridInner>
        </Cell>
        <Cell>
          <GridInner>5</GridInner>
        </Cell>
        <Cell>
          <GridInner>6</GridInner>
        </Cell>
        <Cell>
          <GridInner>7</GridInner>
        </Cell>
        <Cell>
          <GridInner>8</GridInner>
        </Cell>
        <Cell>
          <GridInner>9</GridInner>
        </Cell>
        <Cell>
          <GridInner>10</GridInner>
        </Cell>
        <Cell>
          <GridInner>11</GridInner>
        </Cell>
        <Cell>
          <GridInner>12</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridUnitExample() {
  return (
    <GridOuter>
      <Grid gridUnit="rem" gridGutters={[1, 2, 2]} gridMargins={[1, 2, 4]}>
        <Cell>
          <GridInner>1</GridInner>
        </Cell>
        <Cell>
          <GridInner>2</GridInner>
        </Cell>
        <Cell>
          <GridInner>3</GridInner>
        </Cell>
        <Cell>
          <GridInner>4</GridInner>
        </Cell>
        <Cell>
          <GridInner>5</GridInner>
        </Cell>
        <Cell>
          <GridInner>6</GridInner>
        </Cell>
        <Cell>
          <GridInner>7</GridInner>
        </Cell>
        <Cell>
          <GridInner>8</GridInner>
        </Cell>
        <Cell>
          <GridInner>9</GridInner>
        </Cell>
        <Cell>
          <GridInner>10</GridInner>
        </Cell>
        <Cell>
          <GridInner>11</GridInner>
        </Cell>
        <Cell>
          <GridInner>12</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

function LayoutGridCompactExample() {
  return (
    <GridOuter>
      <Grid gridStyle={STYLE.compact}>
        <Cell>
          <GridInner>1</GridInner>
        </Cell>
        <Cell>
          <GridInner>2</GridInner>
        </Cell>
        <Cell>
          <GridInner>3</GridInner>
        </Cell>
        <Cell>
          <GridInner>4</GridInner>
        </Cell>
        <Cell>
          <GridInner>5</GridInner>
        </Cell>
        <Cell>
          <GridInner>6</GridInner>
        </Cell>
        <Cell>
          <GridInner>7</GridInner>
        </Cell>
        <Cell>
          <GridInner>8</GridInner>
        </Cell>
        <Cell>
          <GridInner>9</GridInner>
        </Cell>
        <Cell>
          <GridInner>10</GridInner>
        </Cell>
        <Cell>
          <GridInner>11</GridInner>
        </Cell>
        <Cell>
          <GridInner>12</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

/* Uber's overrides example reaches for `positive400` and `negative400`. Both are kept verbatim:
 * the Rocoto theme collapses them onto ink, so what you see below IS the theme working. */
function LayoutGridOverridesExample() {
  return (
    <GridOuter>
      <Grid
        overrides={{
          Grid: {
            style: ({ $theme }) => ({
              borderLeftWidth: '1px',
              borderRightWidth: '1px',
              borderTopWidth: '1px',
              borderBottomWidth: '1px',
              borderLeftStyle: 'solid',
              borderTopStyle: 'solid',
              borderRightStyle: 'solid',
              borderBottomStyle: 'solid',
              borderLeftColor: `${$theme.colors.positive400}`,
              borderTopColor: `${$theme.colors.positive400}`,
              borderRightColor: `${$theme.colors.positive400}`,
              borderBottomColor: `${$theme.colors.positive400}`,
            }),
          },
        }}
      >
        <Cell span={[1, 2, 3]}>
          <GridInner>1</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>2</GridInner>
        </Cell>
        <Cell span={[1, 2, 3]}>
          <GridInner>3</GridInner>
        </Cell>
        <Cell
          span={[1, 2, 3]}
          overrides={{
            Cell: {
              style: ({ $theme }) => ({
                outline: `solid 1px ${$theme.colors.negative400}`,
              }),
            },
          }}
        >
          <GridInner>4</GridInner>
        </Cell>
      </Grid>
    </GridOuter>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * FLEX GRID
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const flexItemProps: BlockProps = {
  backgroundColor: 'mono300',
  height: 'scale1000',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
};

function FlexGridBasicExample() {
  return (
    <FlexGrid flexGridColumnCount={3} flexGridColumnGap="scale800" flexGridRowGap="scale800">
      <FlexGridItem {...flexItemProps}>1</FlexGridItem>
      <FlexGridItem {...flexItemProps}>2</FlexGridItem>
      <FlexGridItem {...flexItemProps}>3</FlexGridItem>
      <FlexGridItem {...flexItemProps}>4</FlexGridItem>
      <FlexGridItem {...flexItemProps}>5</FlexGridItem>
      <FlexGridItem {...flexItemProps}>6</FlexGridItem>
    </FlexGrid>
  );
}

const narrowFlexItemProps = {
  ...flexItemProps,
  overrides: {
    Block: {
      // theme type is inferred when in-lined
      style: ({ $theme }: { $theme: typeof LightTheme }) => ({
        width: $theme.sizing.scale1600,
        flexGrow: 0,
      }),
    },
  },
};

function FlexGridUnequalNarrowExample() {
  return (
    <FlexGrid flexGridColumnCount={3} flexGridColumnGap="scale800" flexGridRowGap="scale800">
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
      <FlexGridItem {...narrowFlexItemProps}>Narrow</FlexGridItem>
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
      <FlexGridItem {...narrowFlexItemProps}>Narrow</FlexGridItem>
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
    </FlexGrid>
  );
}

function FlexGridUnequalWideExample() {
  return (
    <FlexGrid
      flexGridColumnCount={3}
      flexGridColumnGap="scale800"
      flexGridRowGap="scale800"
      marginBottom="scale800"
    >
      <FlexGridItem
        {...flexItemProps}
        overrides={{
          Block: {
            // theme type is inferred when in-lined
            style: ({ $theme }: { $theme: typeof LightTheme }) => ({
              width: `calc((200% - ${$theme.sizing.scale800}) / 3)`,
            }),
          },
        }}
      >
        Wide item
      </FlexGridItem>
      <FlexGridItem display="none">
        This invisible one is needed so the margins line up
      </FlexGridItem>
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
      <FlexGridItem {...flexItemProps}>Item</FlexGridItem>
    </FlexGrid>
  );
}

function FlexGridResponsiveExample() {
  return (
    <FlexGrid
      flexGridColumnCount={[1, 2, 4, 8]}
      flexGridColumnGap="scale800"
      flexGridRowGap="scale800"
    >
      <FlexGridItem {...flexItemProps}>1</FlexGridItem>
      <FlexGridItem {...flexItemProps}>2</FlexGridItem>
      <FlexGridItem {...flexItemProps}>3</FlexGridItem>
      <FlexGridItem {...flexItemProps}>4</FlexGridItem>
      <FlexGridItem {...flexItemProps}>5</FlexGridItem>
      <FlexGridItem {...flexItemProps}>6</FlexGridItem>
      <FlexGridItem {...flexItemProps}>7</FlexGridItem>
      <FlexGridItem {...flexItemProps}>8</FlexGridItem>
      <FlexGridItem {...flexItemProps}>9</FlexGridItem>
      <FlexGridItem {...flexItemProps}>10</FlexGridItem>
      <FlexGridItem {...flexItemProps}>11</FlexGridItem>
      <FlexGridItem {...flexItemProps}>12</FlexGridItem>
      <FlexGridItem {...flexItemProps}>13</FlexGridItem>
      <FlexGridItem {...flexItemProps}>14</FlexGridItem>
      <FlexGridItem {...flexItemProps}>15</FlexGridItem>
      <FlexGridItem {...flexItemProps}>16</FlexGridItem>
    </FlexGrid>
  );
}

function FlexGridMissingExample() {
  return (
    <FlexGrid
      flexGridColumnCount={[2, 3, 5, 7]}
      flexGridColumnGap="scale800"
      flexGridRowGap="scale800"
    >
      <FlexGridItem {...flexItemProps}>1</FlexGridItem>
      <FlexGridItem {...flexItemProps}>2</FlexGridItem>
      <FlexGridItem {...flexItemProps}>3</FlexGridItem>
      <FlexGridItem {...flexItemProps}>4</FlexGridItem>
      <FlexGridItem {...flexItemProps}>5</FlexGridItem>
      <FlexGridItem {...flexItemProps}>6</FlexGridItem>
      <FlexGridItem {...flexItemProps}>7</FlexGridItem>
      <FlexGridItem {...flexItemProps}>8</FlexGridItem>
      <FlexGridItem {...flexItemProps}>9</FlexGridItem>
      <FlexGridItem {...flexItemProps}>10</FlexGridItem>
      <FlexGridItem {...flexItemProps}>11</FlexGridItem>
    </FlexGrid>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * ASPECT RATIO BOX
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const boxBorder = {
  Block: {
    style: {
      borderLeftStyle: 'solid',
      borderRightStyle: 'solid',
      borderTopStyle: 'solid',
      borderBottomStyle: 'solid',
      borderLeftWidth: '2px',
      borderTopWidth: '2px',
      borderRightWidth: '2px',
      borderBottomWidth: '2px',
      borderLeftColor: `grey`,
      borderTopColor: `grey`,
      borderRightColor: `grey`,
      borderBottomColor: `grey`,
    },
  },
};

function AspectRatioBoxBasicExample() {
  return (
    <React.Fragment>
      <AspectRatioBox>
        <AspectRatioBoxBody
          display="flex"
          alignItems="center"
          justifyContent="center"
          overrides={boxBorder}
        >
          Square by default
        </AspectRatioBoxBody>
      </AspectRatioBox>
      <AspectRatioBox aspectRatio={16 / 9}>
        <AspectRatioBoxBody
          display="flex"
          alignItems="center"
          justifyContent="center"
          overrides={boxBorder}
        >
          16:9 aspect ratio
        </AspectRatioBoxBody>
      </AspectRatioBox>
    </React.Fragment>
  );
}

/* Uber's example points `src` at a dicebear avatar service that no longer answers, and the kit
 * page runs offline anyway. A neutral placeholder shape stands in as an inline data URI. The
 * example is about the box holding the space, not about the picture. ↯ The shape had its two
 * colours baked into the SVG, which put paint outside the theme's reach — an image that cannot
 * re-theme. It takes them as arguments now, so the placeholder re-inks with the brand. */
const placeholderImageSrc = (ground: string, line: string) =>
  `data:image/svg+xml,${encodeURIComponent(
    [
      '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 120">',
      `<rect width="120" height="120" fill="${ground}"/>`,
      `<rect x="14" y="14" width="92" height="92" fill="none" stroke="${line}" stroke-width="3"/>`,
      `<circle cx="60" cy="60" r="26" fill="none" stroke="${line}" stroke-width="3"/>`,
      '</svg>',
    ].join('')
  )}`;

function AspectRatioBoxImageExample() {
  const [, theme] = useStyletron();
  return (
    <AspectRatioBox width="scale1400">
      <AspectRatioBoxBody
        as="img"
        // @ts-ignore
        src={placeholderImageSrc(theme.colors.backgroundSecondary, theme.colors.contentPrimary)}
      />
    </AspectRatioBox>
  );
}

const CalendarButton = (props: { children: React.ReactNode }) => (
  <Button
    kind={KIND.tertiary}
    overrides={{
      BaseButton: {
        style: {
          paddingTop: 0,
          paddingRight: 0,
          paddingBottom: 0,
          paddingLeft: 0,
        },
      },
    }}
    {...props}
  />
);

const DateBox = (props: { children: React.ReactNode }) => (
  <AspectRatioBox width={`${100 / 7}%`}>
    <AspectRatioBoxBody as={CalendarButton} {...props} />
  </AspectRatioBox>
);

function AspectRatioBoxCalendarExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ display: 'flex', flexWrap: 'wrap' })}>
      <DateBox>Feb 1</DateBox>
      <DateBox>2</DateBox>
      <DateBox>3</DateBox>
      <DateBox>4</DateBox>
      <DateBox>5</DateBox>
      <DateBox>6</DateBox>
      <DateBox>7</DateBox>
      <DateBox>8</DateBox>
      <DateBox>9</DateBox>
      <DateBox>10</DateBox>
      <DateBox>11</DateBox>
      <DateBox>12</DateBox>
      <DateBox>13</DateBox>
      <DateBox>14</DateBox>
      <DateBox>15</DateBox>
      <DateBox>16</DateBox>
      <DateBox>17</DateBox>
      <DateBox>18</DateBox>
      <DateBox>19</DateBox>
      <DateBox>20</DateBox>
      <DateBox>21</DateBox>
      <DateBox>22</DateBox>
      <DateBox>23</DateBox>
      <DateBox>24</DateBox>
      <DateBox>25</DateBox>
      <DateBox>26</DateBox>
      <DateBox>27</DateBox>
      <DateBox>28</DateBox>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * LAYER
 * Uber's wrappers are painted with literal blue/purple/red/orange/yellow/green so the stacking
 * order reads. Colour is not a status system in this product, so the wrappers take their ground
 * from the theme instead and the layers are told apart by their offset.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function LayerWrapper(props: any) {
  const [css, theme] = useStyletron();
  const { offset, children, forwardedRef, fixed } = props;
  return (
    <div
      className={css({
        position: fixed ? 'fixed' : 'absolute',
        top: typeof offset === 'object' ? `${offset.top}px` : offset || '46%',
        left: typeof offset === 'object' ? `${offset.left}px` : offset || '46%',
        width: '200px',
        paddingTop: '20px',
        paddingBottom: '20px',
        paddingLeft: '20px',
        paddingRight: '20px',
        backgroundColor: theme.colors.backgroundSecondary,
        borderLeft: `2px solid ${theme.colors.borderOpaque}`,
        borderTop: `2px solid ${theme.colors.borderOpaque}`,
        borderRight: `2px solid ${theme.colors.borderOpaque}`,
        borderBottom: `2px solid ${theme.colors.borderOpaque}`,
        boxShadow: theme.lighting.shadow600,
        textAlign: 'center',
      })}
      ref={forwardedRef}
    >
      {children}
    </div>
  );
}

function LayerBasicExample() {
  const [isFirstOpen, setIsFirstOpen] = React.useState(false);
  const [isSecondOpen, setIsSecondOpen] = React.useState(false);
  return (
    <React.Fragment>
      <Button onClick={() => setIsFirstOpen(true)}>Render Red Layer</Button>
      {isFirstOpen ? (
        <Layer>
          <LayerWrapper fixed>
            <Button onClick={() => setIsFirstOpen(false)}>Close</Button>
          </LayerWrapper>
        </Layer>
      ) : null}
      <br />
      <br />
      <Button onClick={() => setIsSecondOpen(true)}>Render Orange Layer</Button>
      {isSecondOpen ? (
        <Layer>
          <LayerWrapper fixed offset="48%">
            <Button onClick={() => setIsSecondOpen(false)}>Close</Button>
          </LayerWrapper>
        </Layer>
      ) : null}
    </React.Fragment>
  );
}

const tetherInitialState = {
  isFirstOpen: false,
  isSecondOpen: false,
  isFirstMounted: false,
  isSecondMounted: false,
  offset1: { top: 0, left: 0 },
  offset2: { top: 0, left: 0 },
};

class LayerBasicTetherExample extends React.Component<{}, typeof tetherInitialState> {
  anchorRef1: any = React.createRef();
  popperRef1: any = React.createRef();
  anchorRef2: any = React.createRef();
  popperRef2: any = React.createRef();

  state = tetherInitialState;

  onPopperUpdate: any = (order: string, normalizedOffsets: any) => {
    this.setState({
      [`offset${order}`]: normalizedOffsets.popper,
    } as any);
  };

  render() {
    return (
      <React.Fragment>
        <Button ref={this.anchorRef1} onClick={() => this.setState({ isFirstOpen: true })}>
          Render Blue Layer
        </Button>
        {this.state.isFirstOpen ? (
          <Layer
            onMount={() => this.setState({ isFirstMounted: true })}
            onUnmount={() => this.setState({ isFirstMounted: false })}
          >
            <TetherBehavior
              anchorRef={this.anchorRef1.current}
              popperRef={this.popperRef1.current}
              onPopperUpdate={(...args: any[]) => this.onPopperUpdate(1, ...args)}
              placement={TETHER_PLACEMENT.right}
            >
              <LayerWrapper forwardedRef={this.popperRef1} offset={this.state.offset1}>
                <Button onClick={() => this.setState({ isFirstOpen: false })}>Close</Button>
              </LayerWrapper>
            </TetherBehavior>
          </Layer>
        ) : null}
        <br />
        <br />
        <Button ref={this.anchorRef2} onClick={() => this.setState({ isSecondOpen: true })}>
          Render Purple Layer
        </Button>
        {this.state.isSecondOpen ? (
          <Layer
            onMount={() => this.setState({ isSecondMounted: true })}
            onUnmount={() => this.setState({ isSecondMounted: false })}
          >
            <TetherBehavior
              anchorRef={this.anchorRef2.current}
              popperRef={this.popperRef2.current}
              onPopperUpdate={(...args: any[]) => this.onPopperUpdate(2, ...args)}
              placement={TETHER_PLACEMENT.right}
            >
              <LayerWrapper forwardedRef={this.popperRef2} offset={this.state.offset2}>
                <Button onClick={() => this.setState({ isSecondOpen: false })}>Close</Button>
              </LayerWrapper>
            </TetherBehavior>
          </Layer>
        ) : null}
      </React.Fragment>
    );
  }
}

const zIndexInitialState = {
  isFirstOpen: false,
  isSecondOpen: false,
  isFirstMounted: false,
  isSecondMounted: false,
  setIsFirstMounted: false,
  offset1: { top: 0, left: 0 },
  offset2: { top: 0, left: 0 },
};

/* ↯ Uber's z-index example paints this block with a black/white literal pair. A class component
 * cannot call a hook, so the block is its own function component and reads the theme's inverse
 * pair instead. What the example demonstrates — a stacked element the layer must beat — is the
 * same; only the source of its two colours moved into the theme. */
const ZIndexMarker = () => {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        position: 'relative',
        boxSizing: 'border-box',
        width: '200px',
        marginLeft: '50px',
        display: 'flex',
        alignItems: 'center',
        paddingLeft: '20px',
        paddingRight: '20px',
        paddingTop: '20px',
        paddingBottom: '20px',
        backgroundColor: theme.colors.backgroundInversePrimary,
        color: theme.colors.contentInversePrimary,
        zIndex: 1,
        textAlign: 'center',
      })}
    >
      Element with z-index set
    </div>
  );
};

class LayerZIndexExample extends React.Component<{}, typeof zIndexInitialState> {
  anchorRef1: any = React.createRef();
  popperRef1: any = React.createRef();
  anchorRef2: any = React.createRef();
  popperRef2: any = React.createRef();

  state = zIndexInitialState;

  onPopperUpdate: any = (order: any, normalizedOffsets: any) => {
    this.setState({
      [`offset${order}`]: normalizedOffsets.popper,
    } as any);
  };

  render() {
    return (
      // WARNING: DO NOT COPY THIS EXAMPLE AS IS. THIS EXAMPLE HAS LOCAL LayersManager
      // JUST FOR DOCUMENTATION EXAMPLE PRESENTATIONAL PURPOSE.
      // Do not wrap a single component or a part of an application with
      // LayersManager that has zIndex set to a value other than 'auto' since it
      // will make all the Layers within its context be on top of other Layers
      // outside of the local LayersManager (therefore layers provider) added later.
      // Pass the `zIndex` value to the LayersManager added at the root of your application.
      <LayersManager zIndex={2}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'flex-start',
            alignItems: 'center',
          }}
        >
          <div>
            <Button ref={this.anchorRef1} onClick={() => this.setState({ isFirstOpen: true })}>
              Render Yellow Layer
            </Button>
            {this.state.isFirstOpen ? (
              <Layer
                onMount={() => this.setState({ setIsFirstMounted: true })}
                onUnmount={() => this.setState({ setIsFirstMounted: false })}
              >
                <TetherBehavior
                  anchorRef={this.anchorRef1.current}
                  popperRef={this.popperRef1.current}
                  onPopperUpdate={(...args: any[]) => this.onPopperUpdate(1, ...args)}
                  placement={TETHER_PLACEMENT.right}
                >
                  <LayerWrapper forwardedRef={this.popperRef1} offset={this.state.offset1}>
                    <Button onClick={() => this.setState({ isFirstOpen: false })}>Close</Button>
                  </LayerWrapper>
                </TetherBehavior>
              </Layer>
            ) : null}
            <br />
            <br />
            <Button ref={this.anchorRef2} onClick={() => this.setState({ isSecondOpen: true })}>
              Render Green Layer
            </Button>
            {this.state.isSecondOpen ? (
              <Layer
                onMount={() => this.setState({ isSecondMounted: true })}
                onUnmount={() => this.setState({ isSecondMounted: false })}
              >
                <TetherBehavior
                  anchorRef={this.anchorRef2.current}
                  popperRef={this.popperRef2.current}
                  onPopperUpdate={(...args: any[]) => this.onPopperUpdate(2, ...args)}
                  placement={TETHER_PLACEMENT.right}
                >
                  <LayerWrapper forwardedRef={this.popperRef2} offset={this.state.offset2}>
                    <Button onClick={() => this.setState({ isSecondOpen: false })}>Close</Button>
                  </LayerWrapper>
                </TetherBehavior>
              </Layer>
            ) : null}
          </div>
          <ZIndexMarker />
        </div>
      </LayersManager>
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * PAGE CONTROL
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function PageControlOverflowExample() {
  const NUM_PAGES = 7;
  const [page, setPage] = React.useState(4);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: '20px',
      }}
    >
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          gap: '20px',
          width: '100%',
          alignItems: 'center',
        }}
      >
        <Button size={SIZE.mini} disabled={page === 1} onClick={() => setPage((prevPage) => prevPage - 1)}>
          <ChevronLeft size={16} />
        </Button>
        <span>{page}</span>

        <Button
          size={SIZE.mini}
          disabled={page === NUM_PAGES}
          onClick={() => setPage((prevPage) => prevPage + 1)}
        >
          <ChevronRight size={16} />
        </Button>
      </div>
      <PageControl
        numPages={NUM_PAGES}
        currentPage={page}
        onPageChange={({ nextPage }) => setPage(nextPage)}
        aria-label="seven-pages"
      />
    </div>
  );
}

/* The page-control docs page leads with the interactive playground, not with an example file.
 * Its default state is reproduced here so the plain five-dot control is on the page too. */
function PageControlDefaultExample() {
  const [currentPage, setCurrentPage] = React.useState(2);
  return (
    <PageControl
      currentPage={currentPage}
      numPages={5}
      kind={PAGE_CONTROL_KIND.default}
      onPageChange={({ nextPage }) => setCurrentPage(Math.min(Math.max(nextPage, 1), 5))}
      aria-label="label"
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TILE
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function TileActionExample() {
  return (
    <Tile
      tileKind={TILE_KIND.action}
      leadingContent={() => <Calendar size={36} />}
      label="Book now"
      // @ts-expect-error — `color` is in Uber's example but absent from TileProps and unread by
      // the component. Kept so the example stays theirs; the type says it does nothing.
      color
      onClick={() => alert('booking appointment')}
      headerAlignment={TILE_ALIGNMENT.center}
      bodyAlignment={TILE_ALIGNMENT.center}
    />
  );
}

function TileMultiSelectBatchExample() {
  const [selected, setSelected] = React.useState<Array<number>>([]);

  return (
    <TileGroup
      kind={TILE_GROUP_KIND.multiSelectBatch}
      selected={selected}
      onClick={(_event, index) => {
        if (!selected.includes(index)) {
          setSelected([...selected, index]);
        } else {
          setSelected(selected.filter((value) => value !== index));
        }
      }}
    >
      <Tile tileKind={TILE_KIND.selection} label="Option 1" />
      <Tile tileKind={TILE_KIND.selection} label="Option 2" />
      <Tile tileKind={TILE_KIND.selection} label="Option 3" />
    </TileGroup>
  );
}

function TileMultiSelectLiveExample() {
  const [selected, setSelected] = React.useState<Array<number>>([]);

  return (
    <TileGroup
      kind={TILE_GROUP_KIND.multiSelectLive}
      selected={selected}
      onClick={(_event, index) => {
        if (!selected.includes(index)) {
          setSelected([...selected, index]);
        } else {
          setSelected(selected.filter((value) => value !== index));
        }
      }}
    >
      <Tile tileKind={TILE_KIND.selection} label="Option 1" />
      <Tile tileKind={TILE_KIND.selection} label="Option 2" />
      <Tile tileKind={TILE_KIND.selection} label="Option 3" />
    </TileGroup>
  );
}

function TileSingleSelectExample() {
  const [selected, setSelected] = React.useState<number>(-1);

  return (
    <TileGroup
      kind={TILE_GROUP_KIND.singleSelect}
      selected={selected}
      onClick={(_event, index) => setSelected(index)}
    >
      <Tile tileKind={TILE_KIND.selection} label="Option 1" />
      <Tile tileKind={TILE_KIND.selection} label="Option 2" />
      <Tile tileKind={TILE_KIND.selection} label="Option 3" />
    </TileGroup>
  );
}

function TileSelectionNoTrailingContentExample() {
  const [selected, setSelected] = React.useState<number>(-1);

  return (
    <TileGroup
      kind={TILE_GROUP_KIND.none}
      selected={selected}
      onClick={(_event, index) => setSelected(index)}
    >
      <Tile tileKind={TILE_KIND.selection} label="Option 1" />
      <Tile tileKind={TILE_KIND.selection} label="Option 2" />
      <Tile tileKind={TILE_KIND.selection} label="Option 3" />
    </TileGroup>
  );
}

function TileAlignmentExample() {
  return (
    <Tile
      tileKind={TILE_KIND.action}
      leadingContent={() => <Upload size={48} />}
      label="Mixed"
      headerAlignment={TILE_ALIGNMENT.center}
      bodyAlignment={TILE_ALIGNMENT.right}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * LIST
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function ListBasicExample() {
  const [css] = useStyletron();
  return (
    <ul
      className={css({
        width: '375px',
        paddingLeft: 0,
        paddingRight: 0,
      })}
    >
      <ListItem>
        <ListItemLabel>Label One</ListItemLabel>
      </ListItem>
      <ListItem>
        <ListItemLabel>Label Two</ListItemLabel>
      </ListItem>
      <ListItem>
        <ListItemLabel description="description">Label Three</ListItemLabel>
      </ListItem>
      <ListItem>
        <ListItemLabel description="description">Label Four</ListItemLabel>
      </ListItem>
    </ul>
  );
}

function ListArtworkSizesExample() {
  const [css] = useStyletron();
  return (
    <ul
      className={css({
        width: '375px',
        paddingLeft: 0,
        paddingRight: 0,
      })}
    >
      <ListItem artwork={Search} artworkSize={ARTWORK_SIZES.SMALL}>
        <ListItemLabel description="small">Label One</ListItemLabel>
      </ListItem>
      <ListItem artwork={Search} artworkSize={ARTWORK_SIZES.SMALL}>
        <ListItemLabel description="small">Label Two</ListItemLabel>
      </ListItem>

      <ListItem artwork={Search}>
        <ListItemLabel description="default">Label Three</ListItemLabel>
      </ListItem>
      <ListItem artwork={Search} artworkSize={ARTWORK_SIZES.MEDIUM}>
        <ListItemLabel description="medium">Label Four</ListItemLabel>
      </ListItem>

      <ListItem artwork={Search} artworkSize={ARTWORK_SIZES.LARGE}>
        <ListItemLabel description="large">Label Five</ListItemLabel>
      </ListItem>
      <ListItem artwork={Search} artworkSize={ARTWORK_SIZES.LARGE}>
        <ListItemLabel description="large">Label Six</ListItemLabel>
      </ListItem>

      <ListItem artwork={Search} artworkSize={48}>
        <ListItemLabel description="48px">Label Seven</ListItemLabel>
      </ListItem>
      <ListItem artwork={Search} artworkSize={48}>
        <ListItemLabel description="48px">Label Eight</ListItemLabel>
      </ListItem>
    </ul>
  );
}

function ListEnhancersExample() {
  const [css] = useStyletron();
  return (
    <ul
      className={css({
        width: '375px',
        paddingLeft: 0,
        paddingRight: 0,
      })}
    >
      <ListItem
        endEnhancer={() => (
          <Button size="compact" kind="secondary" shape="pill">
            Action
          </Button>
        )}
      >
        <ListItemLabel>Label</ListItemLabel>
      </ListItem>

      <ListItem
        endEnhancer={() => (
          <React.Fragment>
            <Button shape="round" size="compact" kind="secondary">
              <Check />
            </Button>
            <div style={{ width: '18px' }} />
            <Button shape="round" size="compact" kind="secondary">
              <Check />
            </Button>
          </React.Fragment>
        )}
      >
        <ListItemLabel>Label</ListItemLabel>
      </ListItem>

      <ListItem endEnhancer={() => <ChevronRight title="" />}>
        <ListItemLabel>Label</ListItemLabel>
      </ListItem>

      <ListItem endEnhancer={() => <ListItemLabel>Label</ListItemLabel>}>
        <ListItemLabel>Label</ListItemLabel>
      </ListItem>
    </ul>
  );
}

function ListSublistExample() {
  const [css] = useStyletron();
  return (
    <ul
      className={css({
        width: '375px',
        paddingLeft: 0,
        paddingRight: 0,
      })}
    >
      <ListItem sublist>
        <ListItemLabel sublist>Label One</ListItemLabel>
      </ListItem>
      <ListItem sublist>
        <ListItemLabel sublist>Label Two</ListItemLabel>
      </ListItem>

      <ListItem artwork={Search} endEnhancer={() => <ChevronRight title="" />} sublist>
        <ListItemLabel sublist>Label Three</ListItemLabel>
      </ListItem>
      <ListItem
        artwork={Search}
        artworkSize={ARTWORK_SIZES.SMALL}
        endEnhancer={() => <ChevronRight title="" />}
        sublist
      >
        <ListItemLabel sublist>Label Four</ListItemLabel>
      </ListItem>
      <ListItem
        artwork={Search}
        // Medium is aliased to Small when sublist
        artworkSize={ARTWORK_SIZES.MEDIUM}
        endEnhancer={() => <ChevronRight title="" />}
        sublist
      >
        <ListItemLabel sublist>Label Five</ListItemLabel>
      </ListItem>

      <ListItem
        artwork={Search}
        artworkSize={ARTWORK_SIZES.LARGE}
        endEnhancer={() => <ListItemLabel sublist>Label Six</ListItemLabel>}
        sublist
      >
        <ListItemLabel sublist>Label Six</ListItemLabel>
      </ListItem>
      <ListItem
        artwork={Search}
        artworkSize={ARTWORK_SIZES.LARGE}
        endEnhancer={() => <ListItemLabel sublist>Label Seven</ListItemLabel>}
        sublist
      >
        <ListItemLabel sublist>Label Seven</ListItemLabel>
      </ListItem>
      <ListItem
        artwork={Search}
        artworkSize={ARTWORK_SIZES.LARGE}
        endEnhancer={() => <ListItemLabel sublist>Label Eight</ListItemLabel>}
        sublist
      >
        <ListItemLabel sublist>Label Eight</ListItemLabel>
      </ListItem>
    </ul>
  );
}

const MENU_ITEMS = Array.from({ length: 10 }, () => ({
  title: 'Jane Smith',
  subtitle: 'Senior Engineering Manager',
  icon: Search,
}));

function ListMenuAdapterExample() {
  return (
    <StatefulMenu
      items={MENU_ITEMS}
      onItemSelect={() => console.log('select')}
      overrides={{
        List: {
          style: {
            height: '300px',
            width: '450px',
          },
        },
        Option: {
          props: {
            overrides: {
              ListItem: {
                component: React.forwardRef((props: any, ref) => (
                  <MenuAdapter
                    {...props}
                    ref={ref}
                    artwork={props.item.icon}
                    artworkSize={ARTWORK_SIZES.LARGE}
                    endEnhancer={() => <ChevronRight title="" />}
                  >
                    <ListItemLabel description={props.item.subtitle}>
                      {props.item.title}
                    </ListItemLabel>
                  </MenuAdapter>
                )),
              },
            },
          },
        },
      }}
    />
  );
}

function ListTapTargetExample() {
  return (
    <div>
      <ListItem
        onClick={() => console.log('click')}
        artwork={Check}
        artworkSize={ARTWORK_SIZES.MEDIUM}
        endEnhancer={() => <ChevronRight title="" />}
      >
        <ListItemLabel description="description">Label</ListItemLabel>
      </ListItem>
    </div>
  );
}

/* ListHeading is a documented export of baseui/list with a playground on the docs page but no
 * example file. Built here from the playground's own default props so the export is on the page. */
function ListHeadingExample() {
  const [css] = useStyletron();
  return (
    <ul className={css({ width: '375px', paddingLeft: 0, paddingRight: 0 })}>
      <ListHeading
        heading="Heading"
        subHeading="Sub-heading"
        endEnhancer={() => (
          <Button size={SIZE.compact} shape={SHAPE.pill}>
            Action
          </Button>
        )}
        maxLines={1}
      />
      <ListItem>
        <ListItemLabel description="description">Label One</ListItemLabel>
      </ListItem>
      <ListItem>
        <ListItemLabel description="description">Label Two</ListItemLabel>
      </ListItem>
    </ul>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE SECTION
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function LayoutSection() {
  return (
    <>
      <Section
        t="Layout Grid"
        n="Align the sections of a page to one consistent, responsive column grid."
      >
        <KitGrid>
          <KitTile
            name="Basic"
            span={12}
            rule="Cells align to columns; anything that will not fit on one row wraps."
          >
            <LayoutGridBasicExample />
          </KitTile>
          <KitTile
            name="Span"
            span={12}
            rule="span sets how many columns a cell covers, shrinking to fit the current breakpoint."
          >
            <LayoutGridSpanExample />
          </KitTile>
          <KitTile
            name="Responsive"
            span={12}
            rule="Every Cell prop is responsive: [small, medium, large]."
          >
            <LayoutGridResponsiveExample />
          </KitTile>
          <KitTile name="Hide" span={12} rule="A span of 0 hides the cell at that breakpoint.">
            <LayoutGridHideExample />
          </KitTile>
          <KitTile name="Skip" span={12} rule="skip sets how many columns the cell's left margin covers.">
            <LayoutGridSkipExample />
          </KitTile>
          <KitTile
            name="Shrink"
            span={12}
            rule="skip takes precedence over span, shrinking the cell to stay on one line."
          >
            <LayoutGridSkipShrinkExample />
          </KitTile>
          <KitTile name="Align" span={12} rule="align works on the whole grid or on a single cell.">
            <LayoutGridAlignExample />
          </KitTile>
          <KitTile name="Order" span={12} rule="order proxies the CSS property; cell 1 renders last.">
            <LayoutGridOrderExample />
          </KitTile>
          <KitTile
            name="Behavior"
            span={12}
            rule="A fluid grid ignores the maximum width and keeps filling its container."
          >
            <LayoutGridBehaviorExample />
          </KitTile>
          <KitTile
            name="Custom"
            span={12}
            rule="Columns, gaps, gutters, margins and maximum width are all overridable per grid."
          >
            <LayoutGridCustomExample />
          </KitTile>
          <KitTile name="Unit" span={12} rule="gridUnit swaps the grid's CSS length unit, here to rem.">
            <LayoutGridUnitExample />
          </KitTile>
          <KitTile
            name="Compact"
            span={12}
            rule="The compact style tightens gutters and margins for dense data."
          >
            <LayoutGridCompactExample />
          </KitTile>
          <KitTile
            name="Overrides"
            span={12}
            rule="Uber's example asks for positive400 and negative400; the theme re-inks both."
          >
            <LayoutGridOverridesExample />
          </KitTile>
        </KitGrid>
      </Section>

      <Section
        t="FlexGrid"
        n="Lay equal-width items into a row that wraps into a grid, with gaps only between the items."
      >
        <KitGrid>
          <KitTile name="FlexGrid basic usage" span={6} rule="Three equal columns with a scale800 gap.">
            <FlexGridBasicExample />
          </KitTile>
          <KitTile
            name="FlexGrid unequal (narrow) widths"
            span={6}
            rule="Block style overrides give one item a fixed, narrower width."
          >
            <FlexGridUnequalNarrowExample />
          </KitTile>
          <KitTile
            name="FlexGrid unequal (wide) widths"
            span={6}
            rule="A hidden item after the wide one keeps the row's right margin at zero."
          >
            <FlexGridUnequalWideExample />
          </KitTile>
          <KitTile
            name="FlexGrid missing items"
            span={6}
            rule="A short last row keeps the column alignment of the row above it."
          >
            <FlexGridMissingExample />
          </KitTile>
          <KitTile
            name="FlexGrid responsive usage"
            span={12}
            rule="flexGridColumnCount takes an array of values, one per breakpoint."
          >
            <FlexGridResponsiveExample />
          </KitTile>
        </KitGrid>
      </Section>

      <Section
        t="AspectRatioBox"
        n="Hold a box at a fixed aspect ratio for a given width, so content stops reflowing as it loads."
      >
        <KitGrid>
          <KitTile name="Basic usage" span={6} rule="Square by default; aspectRatio takes any ratio.">
            <AspectRatioBoxBasicExample />
          </KitTile>
          <KitTile
            name="Image in an AspectRatioBox"
            span={4}
            rule="The box reserves the space before the image arrives."
          >
            <AspectRatioBoxImageExample />
          </KitTile>
          <KitTile
            name="Full-width calendar"
            span={12}
            rule="Twenty-eight square buttons at one seventh width each, resizing with the window."
          >
            <AspectRatioBoxCalendarExample />
          </KitTile>
        </KitGrid>
      </Section>

      <Section
        t="Layer"
        n="Render stacking UI — modals, popovers, menus — into a managed host element instead of juggling z-index."
      >
        <KitGrid>
          <KitTile
            name="Layer basic usage"
            span={6}
            rule="Each Layer portals into the LayersManager's host; the second opens on top."
          >
            <LayerBasicExample />
          </KitTile>
          <KitTile
            name="Tether basic usage"
            span={6}
            rule="TetherBehavior positions a layer relative to an anchor element."
          >
            <LayerBasicTetherExample />
          </KitTile>
          <KitTile
            name="Layer with z-index"
            span={12}
            rule="A local LayersManager with an explicit zIndex — for the docs only, per Uber's own warning."
          >
            <LayerZIndexExample />
          </KitTile>
        </KitGrid>
      </Section>

      <Section t="PageControl" n="Show a row of small dots for the available pages or screens.">
        <KitGrid>
          <KitTile name="Default" span={4} rule="Five pages, the docs playground's own default state.">
            <PageControlDefaultExample />
          </KitTile>
          <KitTile
            name="Overflow"
            span={6}
            rule="Five dots render at most; beyond that the end dots shrink to suggest more pages."
          >
            <PageControlOverflowExample />
          </KitTile>
        </KitGrid>
      </Section>

      <Section
        t="Tile"
        n="Let people pick one or several options, or take an action, from a group of stacked button-like blocks."
      >
        <KitGrid>
          <KitTile name="Action prompt" span={4} rule="tileKind=action makes the tile behave as a button.">
            <TileActionExample />
          </KitTile>
          <KitTile
            name="Multi select with checkbox"
            span={6}
            rule="The TileGroup kind decides the trailing control — here a checkbox."
          >
            <TileMultiSelectBatchExample />
          </KitTile>
          <KitTile
            name="Multi select with toggle"
            span={6}
            rule="The same group with a toggle, for selections that apply immediately."
          >
            <TileMultiSelectLiveExample />
          </KitTile>
          <KitTile name="Single select" span={6} rule="One choice at a time, with a radio mark.">
            <TileSingleSelectExample />
          </KitTile>
          <KitTile
            name="No trailing content"
            span={6}
            rule="kind=none keeps the selection behaviour and drops the control."
          >
            <TileSelectionNoTrailingContentExample />
          </KitTile>
          <KitTile
            name="Mixed alignment"
            span={4}
            rule="headerAlignment and bodyAlignment are set independently."
          >
            <TileAlignmentExample />
          </KitTile>
        </KitGrid>
      </Section>

      <Section t="List" n="Stack rows of labels, each with optional artwork and a trailing control.">
        <KitGrid>
          <KitTile name="Basic usage" span={4} rule="ListItem plus ListItemLabel, with an optional description.">
            <ListBasicExample />
          </KitTile>
          <KitTile name="Artwork sizes" span={4} rule="SMALL, default, MEDIUM, LARGE, or any pixel number.">
            <ListArtworkSizesExample />
          </KitTile>
          <KitTile name="End enhancers" span={4} rule="Any node can sit at the end of the row.">
            <ListEnhancersExample />
          </KitTile>
          <KitTile name="Sublist" span={4} rule="Sublist rows indent and drop a type size.">
            <ListSublistExample />
          </KitTile>
          <KitTile
            name="ListHeading"
            span={4}
            rule="A documented export with a playground but no example file; built from the playground's defaults."
          >
            <ListHeadingExample />
          </KitTile>
          <KitTile
            name="Full surface tap target"
            span={4}
            rule="Supplying onClick turns the whole row into one tap target."
          >
            <ListTapTargetExample />
          </KitTile>
          <KitTile
            name="Usage with Menu"
            span={6}
            rule="MenuAdapter puts list rows inside a Menu, keeping the menu's keyboard behaviour."
          >
            <ListMenuAdapterExample />
          </KitTile>
        </KitGrid>
      </Section>
    </>
  );
}
