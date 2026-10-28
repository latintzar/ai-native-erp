/* TABLES — Base Web's tabular surfaces, demonstrated by Base's own docs examples.
 *
 * Seven components, in order: Table (flex-box), Table Semantic (real <table> markup), Table Grid
 * (css-grid), Data Table (strict columns, analysis features), Pagination, Tree View, Drag and Drop
 * List. Every example file under bw-docs/examples/{table,table-semantic,table-grid,data-table,
 * pagination,tree-view,dnd-list} ships here as one Tile, in the order its docs page lists them.
 * Fifty-two examples. The four dnd-list example files the docs page never renders
 * (overrides_short, overrides_state_props, overrides_style, overrides_whole_subcomponent) are
 * appended at the end of that Section rather than dropped.
 *
 * THE COPY IS UBER'S, VERBATIM. The kit is grammar, not sentences: a demo dressed in this
 * product's own nouns would pre-decide which control serves which moment of the product, and that
 * decision belongs to the situations catalogue, later and explicitly. So the edits here are only:
 *   (a) docs-site-local imports and the docs' own page chrome -> this page's chrome,
 *   (b) collision-free names, since every example renders on one page,
 *   (c) type repairs, key fixes, and one hoisted array where two examples ship identical data.
 *
 * (b) BITES HARDER HERE THAN ANYWHERE ELSE. Three of these components export the SAME identifiers
 * — `Table`, `StyledTable`, `StyledHeadCell`, `SortableHeadCell`, `SORT_DIRECTION` all exist in
 * both baseui/table and baseui/table-grid, and `Table` again in baseui/table-semantic. One module
 * cannot hold three of each, so the baseui imports carry Flex/Sem/Grid prefixes naming the
 * component family they came from. Inside each example body that is the only difference from
 * Uber's file.
 *
 * (c) TWO PAIRS OF EXAMPLES SHIP THE SAME DATA in Uber's own files, and here the second reads it
 * off the first rather than repeating it: data-table/row-height-line-clamp takes the twenty-five
 * films of data-table/batch-action, and table-grid/cell-navigation takes the row of
 * table-grid/cell-span. Every string is still Uber's.
 *
 * COLOUR. Where an example demonstrates a STATE the prop stays exactly as Uber wrote it — the
 * delta cell's negative50/positive50 grounds, the cells example's contentPositive/contentNegative
 * arrows, the nested table's Tag kind={positive|negative|primary}. The Rocoto theme collapses
 * negative/warning/positive onto ink, so the demonstration IS the theme working. Raw literals the
 * theme cannot reach are the exception, and each is swapped for a theme token in place:
 *   · table/graph        Uber's blue series stroke+fill -> contentPrimary. The vendored react-vis
 *     stylesheet that ships with the same example is re-sourced the same way: axis lines, ticks,
 *     grid lines, crosshair, hint, legend and search box all interpolate the theme now, so the
 *     chart furniture re-inks and re-corners with the brand instead of holding react-vis's greys.
 *   · table-grid/sortable  head-cell override color:'blue' -> theme accent
 *   · dnd-list/customDragHandle  the light-grey handle -> contentTertiary
 *   · dnd-list/overrideLabel  'darkred' -> theme accent · dnd-list/overrides_style 'red' -> accent
 *   · data-table basic + customized-column-sort paint a swatch from a hand-picked paint chart
 *     (red/green/blue/purple/yellow) in Comic Sans. A shelf of hues is exactly what this product
 *     does not have, so the custom value names a shade of Base's OWN mono ramp, the swatch
 *     resolves it from the theme, and the cell takes the theme's mono type. What the example
 *     demonstrates — an arbitrary renderer, filter and sort inside a strict column — is intact.
 *
 * PACKAGES. The docs list two additional packages for four examples: react-vis (table/graph) and
 * react-virtualized (table/virtual, table/virtual-horizontal-scroll). Both are installed. Neither
 * ships type declarations, hence the suppressions on their imports.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { styled, withStyle, useStyletron } from 'baseui';
import type { Theme } from 'baseui';

import { format } from 'date-fns';

import { Block } from 'baseui/block';
import { Avatar } from 'baseui/avatar';
import { Button, KIND, SIZE } from 'baseui/button';
import { Checkbox } from 'baseui/checkbox';
import { StyledLink } from 'baseui/link';
import { StatefulMenu } from 'baseui/menu';
import { StatefulPopover, PLACEMENT } from 'baseui/popover';
import { Tag } from 'baseui/tag';
import { expandBorderStyles } from 'baseui/styles';
import { ParagraphXSmall, ParagraphSmall, LabelXSmall } from 'baseui/typography';
import {
  Alert,
  ArrowDown,
  ArrowRight,
  ArrowUp,
  Check,
  CheckIndeterminate,
  ChevronDown,
  ChevronRight,
  Delete,
  Overflow,
  Plus,
  Search,
  TriangleDown,
} from 'baseui/icon';

import {
  Table as FlexTable,
  Filter as FlexFilter,
  SortableHeadCell as FlexSortableHeadCell,
  SORT_DIRECTION,
  StyledTable as FlexStyledTable,
  StyledHead as FlexStyledHead,
  StyledHeadCell as FlexStyledHeadCell,
  StyledBody as FlexStyledBody,
  StyledRow as FlexStyledRow,
  StyledCell as FlexStyledCell,
  StyledAction as FlexStyledAction,
} from 'baseui/table';
import type { SortDirection } from 'baseui/table';

import {
  Table as SemTable,
  TableBuilder,
  TableBuilderColumn,
  StyledRoot as SemStyledRoot,
  StyledTable as SemStyledTable,
  StyledTableHeadRow as SemStyledTableHeadRow,
  StyledTableHeadCell as SemStyledTableHeadCell,
  StyledTableBodyRow as SemStyledTableBodyRow,
  StyledTableBodyCell as SemStyledTableBodyCell,
} from 'baseui/table-semantic';

import {
  StyledTable as GridStyledTable,
  StyledHeadCell as GridStyledHeadCell,
  StyledBodyCell as GridStyledBodyCell,
  SortableHeadCell as GridSortableHeadCell,
} from 'baseui/table-grid';

import {
  StatefulDataTable,
  BooleanColumn,
  CategoricalColumn,
  CustomColumn,
  NumericalColumn,
  StringColumn,
  COLUMNS,
  NUMERICAL_FORMATS,
} from 'baseui/data-table';
import type { BatchAction, RowAction, ImperativeMethods } from 'baseui/data-table';

import { Pagination, StatefulPagination } from 'baseui/pagination';

import {
  TreeView,
  StatefulTreeView,
  TreeLabel,
  TreeLabelInteractable,
  toggleIsExpanded,
} from 'baseui/tree-view';
import type { TreeNodeData, TreeLabelProps } from 'baseui/tree-view';

import { StatefulList, List as DndList, arrayMove } from 'baseui/dnd-list';

// @ts-expect-error — react-virtualized ships no type declarations. The docs list it as an additional package for the two virtualized table examples.
import { AutoSizer, List as VirtualList } from 'react-virtualized';
// @ts-expect-error — same package, deep entry point, same absence of declarations.
import { CellMeasurer, CellMeasurerCache } from 'react-virtualized/dist/commonjs/CellMeasurer';
// @ts-expect-error — react-vis ships no type declarations. The docs list it as an additional package for the graph-in-a-cell example alone.
import { AreaSeries, VerticalBarSeries, LineMarkSeries, XYPlot } from 'react-vis';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TABLE — eleven examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* ── table/basic.tsx ── */
const FLEX_BASIC_DATA = [
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
];

const FLEX_BASIC_COLUMNS = ['Name', 'Age', 'Address'];

function FlexTableBasicExample() {
  return <FlexTable columns={FLEX_BASIC_COLUMNS} data={FLEX_BASIC_DATA} />;
}

/* ── table/cells.tsx ── */
const FlexStyledHeadingCell = withStyle(FlexStyledCell, {
  paddingTop: 0,
  paddingBottom: 0,
});

const FlexStyledDeltaCell = withStyle<
  typeof FlexStyledCell,
  { $isNegative: boolean },
  Theme & { customThemeProp: string }
>(FlexStyledCell, ({ $isNegative, $theme }) => ({
  ...$theme.typography.font550,
  alignItems: 'center',
  backgroundColor: $isNegative ? $theme.colors.negative50 : $theme.colors.positive50,
  color: $isNegative ? $theme.colors.negative : $theme.colors.positive,
}));

const FlexStyledLargeText = withStyle(FlexStyledCell, {
  alignItems: 'center',
});

const FLEX_CELLS_DATA: Array<Array<any>> = [
  [
    'Marlyn',
    'Engineering',
    'San Francisco',
    -100,
    1234.5,
    { title: 'New York', data: '100 Broadway st. New York City, New York' },
  ],
  [
    'Luther',
    'Marketing',
    'Seattle',
    50,
    2435.2,
    { title: 'California', data: '100 Market st. San Francisco, California' },
  ],
  [
    'Kiera',
    'Operations',
    'Los Angeles',
    40,
    8348.1,
    { title: 'Australia', data: '100 Macquarie st. Sydney, Australia' },
  ],
  [
    'Edna',
    'Design',
    'Atlanta',
    700,
    2893.4,
    { title: 'New York', data: '100 Broadway st. New York City, New York' },
  ],
  [
    'Soraya',
    'Finance',
    'Denver',
    99,
    8787.3,
    { title: 'California', data: '100 Market st. San Francisco, California' },
  ],
  [
    'Dorris',
    'Legal',
    'Dallas',
    -20,
    6325.2,
    { title: 'Australia', data: '100 Macquarie st. Sydney, Australia' },
  ],
  [
    'Astrid',
    'Product',
    'Tempe',
    0,
    7392.7,
    { title: 'New York', data: '100 Broadway st. New York City, New York' },
  ],
  [
    'Wendie',
    'Engineering',
    'Pittsburgh',
    -15,
    9283.1,
    { title: 'California', data: '100 Market st. San Francisco, California' },
  ],
  [
    'Marna',
    'Marketing',
    'Indianapolis',
    -2,
    7720.9,
    { title: 'Australia', data: '100 Macquarie st. Sydney, Australia' },
  ],
  [
    'Malka',
    'Operations',
    'New Orleans',
    30,
    6273.3,
    { title: 'New York', data: '100 Broadway st. New York City, New York' },
  ],
  [
    'Jospeh',
    'Design',
    'New York City',
    -22,
    8837.4,
    { title: 'California', data: '100 Market st. San Francisco, California' },
  ],
  [
    'Roselee',
    'Finance',
    'Oakland',
    4,
    9277.9,
    { title: 'Australia', data: '100 Macquarie st. Sydney, Australia' },
  ],
  [
    'Justine',
    'Legal',
    'Louisville',
    -9,
    7737.2,
    { title: 'New York', data: '100 Broadway st. New York City, New York' },
  ],
  [
    'Marlon',
    'Engineering',
    'Baltimore',
    -2,
    2330.3,
    { title: 'California', data: '100 Market st. San Francisco, California' },
  ],
  [
    'Mellissa',
    'Marketing',
    'Boulder',
    -30,
    4458.8,
    { title: 'Australia', data: '100 Macquarie st. Sydney, Australia' },
  ],
  [
    'Fausto',
    'Operations',
    'Chicago',
    -10,
    6363.9,
    { title: 'New York', data: '100 Broadway st. New York City, New York' },
  ],
  [
    'Alfredia',
    'Design',
    'Grand Rapids',
    70,
    2235.2,
    { title: 'California', data: '100 Market st. San Francisco, California' },
  ],
  [
    'Abel',
    'Finance',
    'Nashville',
    30,
    9882.3,
    { title: 'Australia', data: '100 Macquarie st. Sydney, Australia' },
  ],
  [
    'Winford',
    'Legal',
    'Sacramento',
    10,
    8774.7,
    { title: 'New York', data: '100 Broadway st. New York City, New York' },
  ],
  [
    'Neil',
    'Product',
    'Columbus',
    -5,
    2673.2,
    { title: 'California', data: '100 Market st. San Francisco, California' },
  ],
];

function FlexTableCellsExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '400px' })}>
      <FlexStyledTable>
        <FlexStyledHead $width="1000px">
          <FlexStyledHeadCell>Name</FlexStyledHeadCell>
          <FlexStyledHeadCell>Role</FlexStyledHeadCell>
          <FlexStyledHeadCell>Delta</FlexStyledHeadCell>
          <FlexStyledHeadCell>Amount</FlexStyledHeadCell>
          <FlexStyledHeadCell>Actions</FlexStyledHeadCell>
        </FlexStyledHead>
        <FlexStyledBody $width="1000px">
          {FLEX_CELLS_DATA.map((row, index) => (
            <FlexStyledRow key={index}>
              <FlexStyledCell>{row[0]}</FlexStyledCell>

              <FlexStyledHeadingCell>
                <Block>
                  <ParagraphXSmall>{row[2]}</ParagraphXSmall>
                  <ParagraphSmall as="div">{row[1]}</ParagraphSmall>
                </Block>
              </FlexStyledHeadingCell>

              <FlexStyledDeltaCell $isNegative={row[3] < 0}>
                <React.Fragment>
                  {row[3] < 0 ? <ArrowDown size={24} /> : <ArrowUp size={24} />}
                  {row[3]}%
                </React.Fragment>
              </FlexStyledDeltaCell>

              <FlexStyledLargeText>
                <Block font="font550">{row[4]}</Block>
                <LabelXSmall paddingLeft="scale200">+1000%</LabelXSmall>
              </FlexStyledLargeText>

              <FlexStyledCell>
                <FlexStyledAction>
                  <Search />
                </FlexStyledAction>

                <FlexStyledAction>
                  <Plus />
                </FlexStyledAction>

                <FlexStyledAction>
                  <Delete />
                </FlexStyledAction>

                <FlexStyledAction>
                  <Overflow />
                </FlexStyledAction>
              </FlexStyledCell>
            </FlexStyledRow>
          ))}
        </FlexStyledBody>
      </FlexStyledTable>
    </div>
  );
}

/* ── table/pagination.tsx ── */
function FlexPaginatedTable(props: { data: any[]; columns: any[] }) {
  const [css, theme] = useStyletron();
  const [page, setPage] = React.useState(1);
  const [limit, setLimit] = React.useState(12);

  const handlePageChange = (nextPage: number) => {
    if (nextPage < 1) {
      return;
    }
    if (nextPage > Math.ceil(props.data.length / limit)) {
      return;
    }
    setPage(nextPage);
  };

  const handleLimitChange = (nextLimit: number) => {
    const nextPageNum = Math.ceil(props.data.length / nextLimit);
    if (nextPageNum < page) {
      setLimit(nextLimit);
      setPage(nextPageNum);
    } else {
      setLimit(nextLimit);
    }
  };

  const window = () => {
    const min = (page - 1) * limit;
    return props.data.slice(min, min + limit);
  };

  return (
    <React.Fragment>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          paddingTop: theme.sizing.scale600,
          paddingBottom: theme.sizing.scale600,
        })}
      >
        <div
          className={css({
            // ...theme.typography.font750
            fontFamily: theme.typography.font750.fontFamily,
            fontWeight: theme.typography.font750.fontWeight,
            fontSize: theme.typography.font750.fontSize,
            lineHeight: theme.typography.font750.lineHeight,
          })}
        >
          Table Example
        </div>
        <Button>
          <div
            className={css({
              paddingLeft: theme.sizing.scale1200,
              paddingRight: theme.sizing.scale1200,
            })}
          >
            Action
          </div>
        </Button>
      </div>
      <div className={css({ height: '500px' })}>
        <FlexTable columns={props.columns} data={window()} />
      </div>
      <div
        className={css({
          paddingTop: theme.sizing.scale600,
          paddingBottom: theme.sizing.scale600,
          paddingRight: theme.sizing.scale800,
          paddingLeft: theme.sizing.scale800,
          display: 'flex',
          justifyContent: 'space-between',
        })}
      >
        <StatefulPopover
          content={({ close }) => (
            <StatefulMenu
              items={Array.from({ length: 100 }, (_, i) => ({
                label: i + 1,
              }))}
              onItemSelect={({ item }) => {
                handleLimitChange(item.label);
                close();
              }}
              overrides={{
                List: {
                  style: { height: '150px', width: '100px' },
                },
              }}
            />
          )}
          placement={PLACEMENT.bottom}
        >
          <Button kind={KIND.tertiary} endEnhancer={() => <TriangleDown title="" />}>
            {`${limit} Rows`}
          </Button>
        </StatefulPopover>

        <Pagination
          currentPage={page}
          numPages={Math.ceil(props.data.length / limit)}
          onPageChange={({ nextPage }) => handlePageChange(nextPage)}
        />
      </div>
    </React.Fragment>
  );
}

const FLEX_PAGINATION_COLUMNS = Array.from({ length: 5 }, () => 'Label');
const FLEX_PAGINATION_DATA = Array.from({ length: 45 }, (_, i) =>
  Array.from({ length: 5 }, () => `row: ${i + 1}`),
);

function FlexTablePaginationExample() {
  return <FlexPaginatedTable columns={FLEX_PAGINATION_COLUMNS} data={FLEX_PAGINATION_DATA} />;
}

/* ── table/sortable.tsx ── */
const FLEX_SORTABLE_DATA = [
  ['Marlyn', 10],
  ['Luther', 15],
  ['Kiera', 13],
  ['Edna', 20],
  ['Soraya', 18],
  ['Dorris', 32],
  ['Astrid', 26],
  ['Wendie', 17],
  ['Marna', 11],
  ['Malka', 14],
  ['Jospeh', 10],
  ['Roselee', 12],
  ['Justine', 35],
  ['Marlon', 30],
  ['Mellissa', 32],
  ['Fausto', 21],
  ['Alfredia', 22],
  ['Abel', 18],
  ['Winford', 19],
  ['Neil', 27],
];

type FlexSortDirection = SortDirection | null;

class FlexTableSortableExample extends React.Component<
  {},
  {
    nameDirection: FlexSortDirection;
    ageDirection: FlexSortDirection;
  }
> {
  state = { nameDirection: null, ageDirection: null };

  handleSort = (title: string, prevDirection: FlexSortDirection) => {
    let nextDirection = null;
    if (prevDirection === SORT_DIRECTION.ASC) {
      nextDirection = SORT_DIRECTION.DESC;
    }
    if (prevDirection === SORT_DIRECTION.DESC) {
      nextDirection = null;
    }
    if (prevDirection === null) {
      nextDirection = SORT_DIRECTION.ASC;
    }

    if (title === 'name') {
      this.setState({
        nameDirection: nextDirection,
        ageDirection: null,
      });
      return;
    }

    if (title === 'age') {
      this.setState({
        nameDirection: null,
        ageDirection: nextDirection,
      });
      return;
    }
  };

  getSortedData = () => {
    if (this.state.nameDirection) {
      const sorted = FLEX_SORTABLE_DATA.slice(0).sort((a, b) =>
        //@ts-ignore
        a[0].localeCompare(b[0]),
      );

      if (this.state.nameDirection === SORT_DIRECTION.ASC) {
        return sorted;
      }

      if (this.state.nameDirection === SORT_DIRECTION.DESC) {
        return sorted.reverse();
      }
    }

    if (this.state.ageDirection) {
      //@ts-ignore
      const sorted = FLEX_SORTABLE_DATA.slice(0).sort((a, b) => a[1] - b[1]);
      if (this.state.ageDirection === SORT_DIRECTION.ASC) {
        return sorted;
      }

      if (this.state.ageDirection === SORT_DIRECTION.DESC) {
        return sorted.reverse();
      }
    }

    return FLEX_SORTABLE_DATA;
  };

  render() {
    return (
      <div style={{ height: '500px', width: '400px' }}>
        <FlexStyledTable>
          <FlexStyledHead>
            <FlexSortableHeadCell
              title="Name"
              direction={this.state.nameDirection}
              onSort={() => this.handleSort('name', this.state.nameDirection)}
              fillClickTarget
            />
            <FlexSortableHeadCell
              title="Age"
              direction={this.state.ageDirection}
              onSort={() => this.handleSort('age', this.state.ageDirection)}
            />
          </FlexStyledHead>
          <FlexStyledBody>
            {this.getSortedData().map((row, index) => (
              <FlexStyledRow key={index}>
                {row.map((cell, cellIndex) => (
                  <FlexStyledCell key={cellIndex}>{cell}</FlexStyledCell>
                ))}
              </FlexStyledRow>
            ))}
          </FlexStyledBody>
        </FlexStyledTable>
      </div>
    );
  }
}

/* ── table/fixed-width-column.tsx ── */
const FLEX_FIXED_DATA = [
  [1, 'Sarah', 'Brown', 31, '100 Broadway st. New York City, New York'],
  [2, 'Jane', 'Smith', 32, '100 Market st. San Francisco, California'],
  [3, 'Joe', 'Black', 33, '100 Macquarie st. Sydney, Australia'],
  [1, 'Sarah', 'Brown', 31, '100 Broadway st. New York City, New York'],
  [2, 'Jane', 'Smith', 32, '100 Market st. San Francisco, California'],
  [3, 'Joe', 'Black', 33, '100 Macquarie st. Sydney, Australia'],
  [1, 'Sarah', 'Brown', 31, '100 Broadway st. New York City, New York'],
  [2, 'Jane', 'Smith', 32, '100 Market st. San Francisco, California'],
  [3, 'Joe', 'Black', 33, '100 Macquarie st. Sydney, Australia'],
  [1, 'Sarah', 'Brown', 31, '100 Broadway st. New York City, New York'],
  [2, 'Jane', 'Smith', 32, '100 Market st. San Francisco, California'],
  [3, 'Joe', 'Black', 33, '100 Macquarie st. Sydney, Australia'],
];

const FLEX_FIXED_COLUMNS = ['Id', 'First Name', 'Last Name', 'Age', 'Address'];

const FlexSmallerHeadCell = withStyle(FlexStyledHeadCell, {
  maxWidth: '30px',
});

const FlexSmallerCell = withStyle(FlexStyledCell, {
  maxWidth: '30px',
});

function FlexTableFixedWidthColumnExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '400px' })}>
      <FlexStyledTable>
        <FlexStyledHead>
          <FlexSmallerHeadCell>ID</FlexSmallerHeadCell>
          {FLEX_FIXED_COLUMNS.slice(1).map((col, index) => (
            <FlexStyledHeadCell key={index}>{col}</FlexStyledHeadCell>
          ))}
        </FlexStyledHead>

        <FlexStyledBody>
          {FLEX_FIXED_DATA.map((row, index) => (
            <FlexStyledRow key={index}>
              <FlexSmallerCell>{row[0]}</FlexSmallerCell>
              {row.slice(1).map((cell, cellIndex) => (
                <FlexStyledCell key={cellIndex}>{cell}</FlexStyledCell>
              ))}
            </FlexStyledRow>
          ))}
        </FlexStyledBody>
      </FlexStyledTable>
    </div>
  );
}

/* ── table/vertical-scroll.tsx ── */
const FLEX_VERTICAL_DATA = [
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
];

const FLEX_VERTICAL_COLUMNS = ['Name', 'Age', 'Address'];

function FlexTableVerticalScrollExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '500px' })}>
      <FlexTable columns={FLEX_VERTICAL_COLUMNS} data={FLEX_VERTICAL_DATA} />
    </div>
  );
}

/* ── table/horizontal-scroll.tsx ── */
// Uber's file repeats the fixed-width-column rows verbatim; here it reads them.
const FLEX_HORIZONTAL_DATA = FLEX_FIXED_DATA;

const FLEX_HORIZONTAL_COLUMNS = ['Id', 'First Name', 'Last Name', 'Age', 'Address'];

function FlexTableHorizontalScrollExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '400px' })}>
      <FlexTable
        columns={FLEX_HORIZONTAL_COLUMNS}
        data={FLEX_HORIZONTAL_DATA}
        horizontalScrollWidth="1000px"
      />
    </div>
  );
}

/* ── table/filter.tsx ── */
const FlexFilterCheckbox = (props: any) => (
  <Checkbox
    checked={props.checked}
    onChange={props.onChange}
    overrides={{
      Root: {
        style: ({ $theme }) => ({
          marginTop: $theme.sizing.scale400,
          marginBottom: $theme.sizing.scale400,
        }),
      },
      Checkmark: { style: { marginLeft: 0 } },
    }}
  >
    {props.children}
  </Checkbox>
);

class FlexFilterTable extends React.Component<any> {
  state = {
    filters: [] as any[],
  };

  FILTER_FUNCTIONS = Array.from({ length: 10 }, (_, i) => (row: any) => row[0] % (i + 1) === 0);

  onFilter = (index: number) => {
    const isActive = !!this.state.filters[index];

    const filters: any = [...this.state.filters];
    if (isActive) {
      filters[index] = null;
    } else {
      filters[index] = this.FILTER_FUNCTIONS[index];
    }
    this.setState({ filters });
  };

  handleReset = () => this.setState({ filters: [] });
  handleSelectAll = () => this.setState({ filters: this.FILTER_FUNCTIONS });

  render() {
    const filteredData = this.state.filters
      .filter(Boolean)
      .reduce((data: any, filter: any) => data.filter(filter), this.props.data);

    return (
      <FlexStyledTable>
        <FlexStyledHead>
          <FlexStyledHeadCell>
            Number
            <FlexFilter
              active={!!this.state.filters.filter(Boolean).length}
              onReset={this.handleReset}
              onSelectAll={this.handleSelectAll}
            >
              {this.FILTER_FUNCTIONS.map((_, index) => (
                <FlexFilterCheckbox
                  key={index}
                  checked={!!this.state.filters[index]}
                  onChange={() => this.onFilter(index)}
                >
                  {`Divisible by ${index + 1}`}
                </FlexFilterCheckbox>
              ))}
            </FlexFilter>
          </FlexStyledHeadCell>
          <FlexStyledHeadCell>Title</FlexStyledHeadCell>
        </FlexStyledHead>

        <FlexStyledBody>
          {filteredData.map((row: any, index: number) => (
            <FlexStyledRow key={index}>
              {row.map((cell: any, cellIndex: number) => (
                <FlexStyledCell key={cellIndex}>{cell}</FlexStyledCell>
              ))}
            </FlexStyledRow>
          ))}
        </FlexStyledBody>
      </FlexStyledTable>
    );
  }
}

function FlexTableFilterExample() {
  const [css] = useStyletron();
  const FILTER_DATA = Array.from({ length: 100 }, (_, i) => [i, 'row title']);
  return (
    <div className={css({ height: '500px' })}>
      <FlexFilterTable data={FILTER_DATA} />
    </div>
  );
}

/* ── table/graph.tsx ── */
const FlexGraphCell = ({ children }: { children: React.ReactNode }) => {
  const [css, theme] = useStyletron();
  return (
    <div className={css({ display: 'flex', alignItems: 'center' })}>
      <div
        className={css({
          marginRight: theme.sizing.scale600,
        })}
      >
        <div
          className={css({
            color: theme.colors.mono800,
            ...theme.typography.font300,
          })}
        >
          100%
        </div>
        <div
          className={css({
            color: theme.colors.mono700,
            ...theme.typography.font100,
          })}
        >
          0%
        </div>
      </div>
      <div>
        <XYPlot width={250} height={48} margin={{ left: 6, right: 6, top: 6, bottom: 6 }}>
          {children}
        </XYPlot>
      </div>
    </div>
  );
};

const FLEX_GRAPH_SERIES = [
  { x: 0, y: 5 },
  { x: 1, y: 15 },
  { x: 2, y: 13 },
  { x: 3, y: 20 },
  { x: 4, y: 13 },
  { x: 5, y: 22 },
];

function FlexTableGraphExample() {
  const [, theme] = useStyletron();
  // Uber's file paints the series a literal blue here. That is a value the theme cannot re-ink, so
  // the series takes the theme's own ink; the react-vis integration is untouched. The vendored
  // react-vis stylesheet below is re-sourced the same way — every value in it that was a baked
  // hue or a fixed corner now reads off the theme, so the chart furniture re-themes too.
  const seriesProps = {
    data: FLEX_GRAPH_SERIES,
    opacity: 1,
    stroke: theme.colors.contentPrimary,
    fill: theme.colors.contentPrimary,
  };
  return (
    <React.Fragment>
      <style
        dangerouslySetInnerHTML={{
          __html: `.react-vis-magic-css-import-rule{display:inherit}.rv-treemap{font-size:12px;position:relative}.rv-treemap__leaf{overflow:hidden;position:absolute}.rv-treemap__leaf--circle{align-items:center;border-radius:100%;display:flex;justify-content:center}.rv-treemap__leaf__content{overflow:hidden;padding:10px;text-overflow:ellipsis}.rv-xy-plot{color:${theme.colors.contentTertiary};position:relative}.rv-xy-plot canvas{pointer-events:none}.rv-xy-plot .rv-xy-canvas{pointer-events:none;position:absolute}.rv-xy-plot__inner{display:block}.rv-xy-plot__axis__line{fill:none;stroke-width:2px;stroke:${theme.colors.borderOpaque}}.rv-xy-plot__axis__tick__line{stroke:${theme.colors.borderOpaque}}.rv-xy-plot__axis__tick__text{fill:${theme.colors.contentTertiary};font-size:11px}.rv-xy-plot__axis__title text{fill:${theme.colors.contentSecondary};font-size:11px}.rv-xy-plot__grid-lines__line{stroke:${theme.colors.borderOpaque}}.rv-xy-plot__circular-grid-lines__line{fill-opacity:0;stroke:${theme.colors.borderOpaque}}.rv-xy-plot__series,.rv-xy-plot__series path{pointer-events:all}.rv-xy-plot__series--line{fill:none;stroke:${theme.colors.contentPrimary};stroke-width:2px}.rv-crosshair{position:absolute;font-size:11px;pointer-events:none}.rv-crosshair__line{background:${theme.colors.contentPrimary};width:1px}.rv-crosshair__inner{position:absolute;text-align:left;top:0}.rv-crosshair__inner__content{border-radius:${theme.borders.radius200};background:${theme.colors.backgroundInversePrimary};color:${theme.colors.contentInversePrimary};font-size:12px;padding:7px 10px;box-shadow:0 2px 4px rgba(0,0,0,0.5)}.rv-crosshair__inner--left{right:4px}.rv-crosshair__inner--right{left:4px}.rv-crosshair__title{font-weight:bold;white-space:nowrap}.rv-crosshair__item{white-space:nowrap}.rv-hint{position:absolute;pointer-events:none}.rv-hint__content{border-radius:${theme.borders.radius200};padding:7px 10px;font-size:12px;background:${theme.colors.backgroundInversePrimary};box-shadow:0 2px 4px rgba(0,0,0,0.5);color:${theme.colors.contentInversePrimary};text-align:left;white-space:nowrap}.rv-discrete-color-legend{box-sizing:border-box;overflow-y:auto;font-size:12px}.rv-discrete-color-legend.horizontal{white-space:nowrap}.rv-discrete-color-legend-item{color:${theme.colors.contentPrimary};border-radius:1px;padding:9px 10px}.rv-discrete-color-legend-item.horizontal{display:inline-block}.rv-discrete-color-legend-item.horizontal .rv-discrete-color-legend-item__title{margin-left:0;display:block}.rv-discrete-color-legend-item__color{display:inline-block;vertical-align:middle;overflow:visible}.rv-discrete-color-legend-item__color__path{stroke:${theme.colors.borderOpaque};stroke-width:2px}.rv-discrete-color-legend-item__title{margin-left:10px}.rv-discrete-color-legend-item.disabled{color:${theme.colors.contentStateDisabled}}.rv-discrete-color-legend-item.clickable{cursor:pointer}.rv-discrete-color-legend-item.clickable:hover{background:${theme.colors.backgroundSecondary}}.rv-search-wrapper{display:flex;flex-direction:column}.rv-search-wrapper__form{flex:0}.rv-search-wrapper__form__input{width:100%;color:${theme.colors.contentTertiary};border:1px solid ${theme.colors.borderOpaque};padding:7px 10px;font-size:12px;box-sizing:border-box;border-radius:${theme.borders.radius100};margin:0 0 9px;outline:0}.rv-search-wrapper__contents{flex:1;overflow:auto}.rv-continuous-color-legend{font-size:12px}.rv-continuous-color-legend .rv-gradient{height:4px;border-radius:${theme.borders.radius100};margin-bottom:5px}.rv-continuous-size-legend{font-size:12px}.rv-continuous-size-legend .rv-bubbles{text-align:justify;overflow:hidden;margin-bottom:5px;width:100%}.rv-continuous-size-legend .rv-bubble{background:${theme.colors.backgroundTertiary};display:inline-block;vertical-align:bottom}.rv-continuous-size-legend .rv-spacer{display:inline-block;font-size:0;line-height:0;width:100%}.rv-legend-titles{height:16px;position:relative}.rv-legend-titles__left,.rv-legend-titles__right,.rv-legend-titles__center{position:absolute;white-space:nowrap;overflow:hidden}.rv-legend-titles__center{display:block;text-align:center;width:100%}.rv-legend-titles__right{right:0}.rv-radial-chart .rv-xy-plot__series--label{pointer-events:none}`,
        }}
      />
      <FlexStyledTable>
        <FlexStyledHead>
          <FlexStyledHeadCell>Description</FlexStyledHeadCell>
          <FlexStyledHeadCell>Graph</FlexStyledHeadCell>
        </FlexStyledHead>
        <FlexStyledBody>
          <FlexStyledRow>
            <FlexStyledCell>Visitors</FlexStyledCell>
            <FlexStyledCell>
              <FlexGraphCell>
                <AreaSeries {...seriesProps} />
              </FlexGraphCell>
            </FlexStyledCell>
          </FlexStyledRow>
          <FlexStyledRow>
            <FlexStyledCell>Revenue</FlexStyledCell>
            <FlexStyledCell>
              <FlexGraphCell>
                <VerticalBarSeries {...seriesProps} />
              </FlexGraphCell>
            </FlexStyledCell>
          </FlexStyledRow>
          <FlexStyledRow>
            <FlexStyledCell>Bounce Rate</FlexStyledCell>
            <FlexStyledCell>
              <FlexGraphCell>
                <LineMarkSeries {...seriesProps} />
              </FlexGraphCell>
            </FlexStyledCell>
          </FlexStyledRow>
        </FlexStyledBody>
      </FlexStyledTable>
    </React.Fragment>
  );
}

/* ── table/virtual.tsx ── */
const FLEX_VIRTUAL_DATA = [
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
  ['Sarah Brown', 31, '100 Broadway st. New York City, New York'],
  ['Jane Smith', 32, '100 Market st. San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie st. Sydney, Australia'],
];

const FLEX_VIRTUAL_COLUMNS = ['Name', 'Age', 'Address'];

const flexVirtualCache = new CellMeasurerCache({
  defaultHeight: 36,
  fixedWidth: true,
});

function FlexTableVirtualExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ width: '500px' })}>
      <FlexStyledTable
        role="grid"
        aria-colcount={FLEX_VIRTUAL_COLUMNS.length}
        aria-rowcount={FLEX_VIRTUAL_DATA.length}
      >
        <FlexStyledHead role="row">
          {FLEX_VIRTUAL_COLUMNS.map((column, index) => (
            <FlexStyledHeadCell role="columnheader" key={index}>
              {column}
            </FlexStyledHeadCell>
          ))}
        </FlexStyledHead>

        <div className={css({ height: '100px' })}>
          <AutoSizer>
            {({ width, height }: { width: number; height: number }) => (
              <VirtualList
                height={height}
                width={width}
                rowCount={FLEX_VIRTUAL_DATA.length}
                rowHeight={flexVirtualCache.rowHeight}
                deferredMeasurementCache={flexVirtualCache}
                rowRenderer={({ index, key, parent, style }: any) => (
                  <CellMeasurer
                    cache={flexVirtualCache}
                    columnIndex={0}
                    key={key}
                    parent={parent}
                    rowIndex={index}
                  >
                    <FlexStyledRow role="row" key={key} style={style}>
                      {FLEX_VIRTUAL_DATA[index].map((cell, index) => (
                        <FlexStyledCell role="gridcell" key={index}>
                          {cell}
                        </FlexStyledCell>
                      ))}
                    </FlexStyledRow>
                  </CellMeasurer>
                )}
              />
            )}
          </AutoSizer>
        </div>
      </FlexStyledTable>
    </div>
  );
}

/* ── table/virtual-horizontal-scroll.tsx ── */
const FLEX_VIRTUAL_HORIZONTAL_WIDTH = 1000;

const flexVirtualHorizontalCache = new CellMeasurerCache({
  defaultHeight: 36,
  fixedHeight: true,
});

function FlexTableVirtualHorizontalExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ width: '500px' })}>
      <FlexStyledTable
        role="grid"
        aria-colcount={FLEX_VIRTUAL_COLUMNS.length}
        aria-rowcount={FLEX_VIRTUAL_DATA.length}
      >
        <FlexStyledHead role="row" $width={`${FLEX_VIRTUAL_HORIZONTAL_WIDTH}px`}>
          {FLEX_VIRTUAL_COLUMNS.map((column, index) => (
            <FlexStyledHeadCell role="columnheader" key={index}>
              {column}
            </FlexStyledHeadCell>
          ))}
        </FlexStyledHead>

        <div className={css({ height: '100%' })}>
          <AutoSizer>
            {({ height }: { height: number }) => (
              <VirtualList
                height={height}
                width={FLEX_VIRTUAL_HORIZONTAL_WIDTH}
                rowCount={FLEX_VIRTUAL_DATA.length}
                rowHeight={flexVirtualHorizontalCache.rowHeight}
                deferredMeasurementCache={flexVirtualHorizontalCache}
                rowRenderer={({ index, key, parent, style }: any) => (
                  <CellMeasurer
                    cache={flexVirtualHorizontalCache}
                    columnIndex={0}
                    key={key}
                    parent={parent}
                    rowIndex={index}
                  >
                    <FlexStyledRow role="row" key={key} style={style}>
                      {FLEX_VIRTUAL_DATA[index].map((cell, index) => (
                        <FlexStyledCell role="gridcell" key={index}>
                          {cell}
                        </FlexStyledCell>
                      ))}
                    </FlexStyledRow>
                  </CellMeasurer>
                )}
              />
            )}
          </AutoSizer>
        </div>
      </FlexStyledTable>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TABLE SEMANTIC — nine examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* ── table-semantic/basic.tsx ── */
const SEM_BASIC_COLUMNS = ['Name', 'Age', 'Address'];

const SEM_BASIC_DATA = [
  ['Sarah Brown', 31, '100 Broadway St., New York City, New York'],
  ['Jane Smith', 32, '100 Market St., San Francisco, California'],
  ['Joe Black', 33, '100 Macquarie St., Sydney, Australia'],
];

function SemTableBasicExample() {
  return <SemTable columns={SEM_BASIC_COLUMNS} data={SEM_BASIC_DATA} />;
}

/* ── table-semantic/scroll.tsx ── */
const SEM_SIZER = Array(100).fill(null);

const SEM_SCROLL_COLUMNS = SEM_SIZER.map((_col, colIndex) => {
  return `Column ${colIndex + 1}`;
});

const SEM_SCROLL_DATA = SEM_SIZER.map((_row, rowIndex) => {
  return SEM_SIZER.map((_col, colIndex) => {
    return `Row ${rowIndex + 1}.${colIndex + 1}`;
  });
});

const semScrollOverrides = {
  Root: {
    style: {
      maxHeight: '300px',
    },
  },
};

function SemTableScrollExample() {
  return <SemTable overrides={semScrollOverrides} columns={SEM_SCROLL_COLUMNS} data={SEM_SCROLL_DATA} />;
}

/* ── table-semantic/empty-message.tsx ── */
const SEM_EMPTY_COLUMNS = ['Name', 'Age', 'Address'];

function SemTableEmptyMessageExample() {
  return <SemTable columns={SEM_EMPTY_COLUMNS} data={[]} emptyMessage={<h1>No data</h1>} />;
}

/* ── table-semantic/builder.tsx ── */
type SemRow = { bar: string; foo: number; url: string };
const SEM_BUILDER_DATA: SemRow[] = [
  {
    foo: 10,
    bar: 'banana',
    url: 'https://example.com/b',
  },
  {
    foo: 1,
    bar: 'carrot',
    url: 'https://example.com/c',
  },
  {
    foo: 2,
    bar: 'apple',
    url: 'https://example.com/a',
  },
];

function SemTableBuilderExample() {
  return (
    <TableBuilder data={SEM_BUILDER_DATA}>
      <TableBuilderColumn header="Produce">
        {(row: SemRow) => <StyledLink href={row.url}>{row.bar}</StyledLink>}
      </TableBuilderColumn>
      <TableBuilderColumn header="Quantity" numeric>
        {(row: SemRow) => row.foo}
      </TableBuilderColumn>
    </TableBuilder>
  );
}

/* ── table-semantic/sortable.tsx ── */
function SemTableSortableExample() {
  const [sortColumn, setSortColumn] = React.useState('bar');
  const [sortAsc, setSortAsc] = React.useState(true);
  type Row = {
    foo: number;
    bar: string;
    url: string;
  };
  const [data] = React.useState<Row[]>([
    {
      foo: 10,
      bar: 'banana',
      url: 'https://example.com/b',
    },
    {
      foo: 1,
      bar: 'carrot',
      url: 'https://example.com/c',
    },
    {
      foo: 2,
      bar: 'apple',
      url: 'https://example.com/a',
    },
  ]);

  const sortedData = React.useMemo(() => {
    return data.slice().sort((a: Row, b: Row) => {
      const left = sortAsc ? a : b;
      const right = sortAsc ? b : a;
      const leftValue = String(left[sortColumn as keyof Row]);
      const rightValue = String(right[sortColumn as keyof Row]);

      return leftValue.localeCompare(rightValue, 'en', {
        numeric: true,
        sensitivity: 'base',
      });
    });
  }, [sortColumn, sortAsc, data]);

  function handleSort(id: string) {
    if (id === sortColumn) {
      setSortAsc((asc) => !asc);
    } else {
      setSortColumn(id);
      setSortAsc(true);
    }
  }

  return (
    <TableBuilder
      data={sortedData}
      sortColumn={sortColumn}
      sortOrder={sortAsc ? 'ASC' : 'DESC'}
      onSort={handleSort}
    >
      <TableBuilderColumn id="bar" header="Produce" sortable>
        {(row: Row) => <StyledLink href={row.url}>{row.bar}</StyledLink>}
      </TableBuilderColumn>
      <TableBuilderColumn id="foo" header="Quantity" numeric sortable>
        {(row: Row) => row.foo}
      </TableBuilderColumn>
    </TableBuilder>
  );
}

/* ── table-semantic/toggleable.tsx ── */
function SemTableToggleableExample() {
  type Row = {
    foo: number;
    bar: string;
    url: string;
    selected: boolean;
  };
  const [data, setData] = React.useState<Row[]>([
    {
      foo: 10,
      bar: 'banana',
      url: 'https://example.com/b',
      selected: true,
    },
    {
      foo: 1,
      bar: 'carrot',
      url: 'https://example.com/c',
      selected: false,
    },
    {
      foo: 2,
      bar: 'apple',
      url: 'https://example.com/a',
      selected: false,
    },
  ]);

  const hasAny = Boolean(data.length);
  const hasAll = hasAny && data.every((x) => x.selected);
  const hasSome = hasAny && data.some((x) => x.selected);

  function toggleAll() {
    setData((data) =>
      data.map((row) => ({
        ...row,
        selected: !hasAll,
      })),
    );
  }

  function toggle(event: any) {
    const { name, checked } = event.currentTarget;

    setData((data) =>
      data.map((row) => ({
        ...row,
        selected: String(row.foo) === name ? checked : row.selected,
      })),
    );
  }

  return (
    <TableBuilder data={data}>
      <TableBuilderColumn
        overrides={{
          TableHeadCell: { style: { width: '1%' } },
          TableBodyCell: { style: { width: '1%' } },
        }}
        header={
          <Checkbox checked={hasAll} isIndeterminate={!hasAll && hasSome} onChange={toggleAll} />
        }
      >
        {(row: Row) => <Checkbox name={'' + row.foo} checked={row.selected} onChange={toggle} />}
      </TableBuilderColumn>
      <TableBuilderColumn header="Produce">
        {(row: Row) => <StyledLink href={row.url}>{row.bar}</StyledLink>}
      </TableBuilderColumn>
      <TableBuilderColumn header="Quantity" numeric>
        {(row: Row) => row.foo}
      </TableBuilderColumn>
    </TableBuilder>
  );
}

/* ── table-semantic/alternating.tsx ── */
const SEM_ALTERNATING_DATA = [
  {
    foo: 10,
    bar: 'banana',
    url: 'https://example.com/b',
  },
  {
    foo: 1,
    bar: 'carrot',
    url: 'https://example.com/c',
  },
  {
    foo: 2,
    bar: 'apple',
    url: 'https://example.com/a',
  },
];

function SemTableAlternatingExample() {
  const overrides = {
    TableBodyRow: {
      style: ({ $theme, $rowIndex }: any) => ({
        backgroundColor:
          $rowIndex % 2 ? $theme.colors.backgroundPrimary : $theme.colors.backgroundSecondary,
        ':hover': {
          backgroundColor: $theme.colors.backgroundTertiary,
        },
      }),
    },
  };

  return (
    <TableBuilder data={SEM_ALTERNATING_DATA} overrides={overrides}>
      <TableBuilderColumn header="Produce">
        {(row: any) => <StyledLink href={row.url}>{row.bar}</StyledLink>}
      </TableBuilderColumn>
      <TableBuilderColumn header="Quantity" numeric>
        {(row: any) => row.foo}
      </TableBuilderColumn>
    </TableBuilder>
  );
}

/* ── table-semantic/cells.tsx ── */
const SEM_CELLS_ROW = {
  foo: 10,
  bar: 'banana',
  url: 'https://example.com/b',
  largeNumber: 1000000,
  // Uber loads the avatar from avatars.dicebear.com, an endpoint that has since been retired.
  // Left empty, Base's Avatar draws the initials of the name it is given, which keeps the cell
  // demonstrating what it demonstrates without reaching for a host that no longer answers.
  avatarSrc: '',
  name: 'User Name',
  title: 'Job Title',
  list: ['One', 'Two', 'Three'],
};

type SemCellsRow = typeof SEM_CELLS_ROW;

const SEM_CELLS_DATA = Array.from(new Array(20)).fill(SEM_CELLS_ROW);

function SemAvatarCell({
  src,
  title,
  subtitle,
}: {
  src: string;
  title: string;
  subtitle: string;
}) {
  const [css, theme] = useStyletron();
  return (
    <div className={css({ display: 'flex', alignItems: 'center' })}>
      <Avatar name={title} size="48px" src={src} />
      <div
        className={css({
          paddingLeft: theme.sizing.scale550,
          whiteSpace: 'nowrap',
        })}
      >
        <p
          className={css({
            ...theme.typography.LabelSmall,
            margin: 0,
          })}
        >
          {title}
        </p>
        <p
          className={css({
            ...theme.typography.ParagraphSmall,
            marginBottom: 0,
            marginTop: '4px',
          })}
        >
          {subtitle}
        </p>
      </div>
    </div>
  );
}

function SemNumberCell({ value, delta }: { value: number; delta: number }) {
  const [css, theme] = useStyletron();
  const positive = delta >= 0;
  return (
    <div className={css({ display: 'flex', alignItems: 'center' })}>
      <span className={css({ ...theme.typography.MonoParagraphSmall })}>
        {new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: 'USD',
        }).format(value)}
      </span>
      <div
        className={css({
          alignItems: 'center',
          display: 'flex',
          paddingLeft: theme.sizing.scale300,
          color: positive ? theme.colors.contentPositive : theme.colors.contentNegative,
        })}
      >
        {positive ? <ArrowUp /> : <ArrowDown />}
        <span
          className={css({
            ...theme.typography.MonoLabelSmall,
            paddingLeft: '2px',
          })}
        >
          {delta}%
        </span>
      </div>
    </div>
  );
}

function SemTagsCell({ tags }: { tags: Array<string> }) {
  const [css] = useStyletron();
  return (
    <div className={css({ display: 'flex', alignItems: 'center' })}>
      {tags.map((tag) => {
        return (
          <Tag key={tag} closeable={false}>
            {tag}
          </Tag>
        );
      })}
    </div>
  );
}

function SemButtonsCell({ labels }: { labels: Array<string> }) {
  const [css, theme] = useStyletron();
  return (
    <div className={css({ display: 'flex', alignItems: 'center' })}>
      {labels.map((label, index) => {
        return (
          <Button
            kind={KIND.secondary}
            size={SIZE.compact}
            overrides={{
              BaseButton: {
                style: {
                  marginLeft: index > 0 ? theme.sizing.scale300 : 0,
                },
              },
            }}
            key={label}
          >
            {label}
          </Button>
        );
      })}
    </div>
  );
}

function SemTableCellsExample() {
  return (
    <TableBuilder overrides={{ Root: { style: { maxHeight: '300px' } } }} data={SEM_CELLS_DATA}>
      <TableBuilderColumn<SemCellsRow> header="Avatar">
        {(row) => <SemAvatarCell src={row.avatarSrc} title={row.name} subtitle={row.title} />}
      </TableBuilderColumn>

      <TableBuilderColumn<SemCellsRow> header="Number positive">
        {(row) => <SemNumberCell value={row.largeNumber} delta={0.51} />}
      </TableBuilderColumn>

      <TableBuilderColumn<SemCellsRow> header="Number negative">
        {(row) => <SemNumberCell value={row.largeNumber} delta={-0.51} />}
      </TableBuilderColumn>

      <TableBuilderColumn<SemCellsRow> header="Tags">
        {(row) => <SemTagsCell tags={row.list} />}
      </TableBuilderColumn>

      <TableBuilderColumn<SemCellsRow> header="Buttons">
        {(row) => <SemButtonsCell labels={row.list} />}
      </TableBuilderColumn>
    </TableBuilder>
  );
}

/* ── table-semantic/span.tsx ── */
function SemTableSpanExample() {
  return (
    <SemStyledRoot>
      <SemStyledTable>
        <SemStyledTableHeadRow>
          <SemStyledTableHeadCell colSpan={2}>Parent</SemStyledTableHeadCell>
          <SemStyledTableHeadCell colSpan={2}>Children</SemStyledTableHeadCell>
        </SemStyledTableHeadRow>
        <SemStyledTableBodyRow>
          <SemStyledTableBodyCell rowSpan={3}>Sarah</SemStyledTableBodyCell>
          <SemStyledTableBodyCell rowSpan={3}>Brown</SemStyledTableBodyCell>
          <SemStyledTableBodyCell>Sally</SemStyledTableBodyCell>
          <SemStyledTableBodyCell>Brown</SemStyledTableBodyCell>
        </SemStyledTableBodyRow>
        <SemStyledTableBodyRow>
          <SemStyledTableBodyCell>Jimmy</SemStyledTableBodyCell>
          <SemStyledTableBodyCell>Brown</SemStyledTableBodyCell>
        </SemStyledTableBodyRow>
        <SemStyledTableBodyRow>
          <SemStyledTableBodyCell>Joe</SemStyledTableBodyCell>
          <SemStyledTableBodyCell>Black</SemStyledTableBodyCell>
        </SemStyledTableBodyRow>
        <SemStyledTableBodyRow>
          <SemStyledTableBodyCell rowSpan={2}>Jane</SemStyledTableBodyCell>
          <SemStyledTableBodyCell rowSpan={2}>Smith</SemStyledTableBodyCell>
          <SemStyledTableBodyCell>Molly</SemStyledTableBodyCell>
          <SemStyledTableBodyCell>Smith</SemStyledTableBodyCell>
        </SemStyledTableBodyRow>
        <SemStyledTableBodyRow>
          <SemStyledTableBodyCell>Jesse</SemStyledTableBodyCell>
          <SemStyledTableBodyCell>Brown</SemStyledTableBodyCell>
        </SemStyledTableBodyRow>
      </SemStyledTable>
    </SemStyledRoot>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TABLE GRID — five examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* ── table-grid/basic.tsx ── */
const GRID_BASIC_DATA = Array(100)
  .fill(2)
  .map(() => [
    `Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
     labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut`,
    'Cell two',
    'Cell three',
  ]);

function GridTableBasicExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '750px' })}>
      <GridStyledTable role="grid" $gridTemplateColumns="minmax(400px, max-content) 200px 200px">
        <div role="row" className={css({ display: 'contents' })}>
          <GridStyledHeadCell>Column 1</GridStyledHeadCell>
          <GridStyledHeadCell>Column 2</GridStyledHeadCell>
          <GridStyledHeadCell>Column 3</GridStyledHeadCell>
        </div>
        {GRID_BASIC_DATA.map((row, index) => {
          return (
            <div role="row" key={index} className={css({ display: 'contents' })}>
              <GridStyledBodyCell>{row[0]}</GridStyledBodyCell>
              <GridStyledBodyCell>{row[1]}</GridStyledBodyCell>
              <GridStyledBodyCell>{row[2]}</GridStyledBodyCell>
            </div>
          );
        })}
      </GridStyledTable>
    </div>
  );
}

/* ── table-grid/nested.tsx ── */
function buildGridRow(status: string) {
  return [
    'Baseui Github CI Job',
    status,
    new Date(2019, 6, 22),
    'feat(side-navigation): improve item rendering performance',
    'https://github.com/uber/baseweb/pull/1449',
    'Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt',
    [
      [
        'buildkite/baseui',
        'running',
        new Date(2019, 6, 22),
        'Build #7728 passed (20 minutes, 1 second)', // theme-gate-allow: a build number in Uber's verbatim demo data, not paint
        'https://buildkite.com/uberopensource/baseui/builds/7728',
      ],
      [
        'buildkite/baseui/docker-package-e2e',
        'running',
        new Date(2019, 6, 22),
        'Passed (6 minutes, 44 seconds)',
        'https://buildkite.com/uberopensource/baseui/builds/7728#54927bc9-88e0-4d0b-80b0-f60b8a2298e4', // theme-gate-allow: a job-id fragment in Uber's verbatim Buildkite URL, not paint
      ],
      [
        'buildkite/baseui/docker-package-unit',
        'passed',
        new Date(2019, 6, 22),
        'Passed (7 minutes)',
        'https://buildkite.com/uberopensource/baseui/builds/7728#fea8c317-b65b-4c5f-9fad-b7a329a26237', // theme-gate-allow: a job-id fragment in Uber's verbatim Buildkite URL, not paint
      ],
      [
        'buildkite/baseui/documentation-site-link-checker',
        'failed',
        new Date(2019, 6, 22),
        'Passed (1 minute, 33 seconds)',
        'https://buildkite.com/uberopensource/baseui/builds/7728#eaa5998f-69a4-4b94-9a9b-4dd2bbd8c985', // theme-gate-allow: a job-id fragment in Uber's verbatim Buildkite URL, not paint
      ],
      [
        'buildkite/baseui/eslint',
        'passed',
        new Date(2019, 6, 22),
        'Passed (1 minute, 34 seconds)',
        'https://buildkite.com/uberopensource/baseui/builds/7728#a658a503-472f-43aa-80b5-708d39951cf7', // theme-gate-allow: a job-id fragment in Uber's verbatim Buildkite URL, not paint
      ],
      [
        'buildkite/baseui/flowtype',
        'passed',
        new Date(2019, 6, 22),
        'Passed (1 minute, 33 seconds)',
        'https://buildkite.com/uberopensource/baseui/builds/7728',
      ],
      [
        'buildkite/baseui/jest',
        'running',
        new Date(2019, 6, 22),
        'Passed (1 minute, 33 seconds)',
        'https://buildkite.com/uberopensource/baseui/builds/7728',
      ],
      [
        'buildkite/baseui/pipeline',
        'running',
        new Date(2019, 6, 22),
        'Passed (1 minute, 33 seconds)',
        'https://buildkite.com/uberopensource/baseui/builds/7728',
      ],
    ],
  ];
}

const GRID_NESTED_DATA = [
  buildGridRow('running'),
  buildGridRow('running'),
  buildGridRow('failed'),
  buildGridRow('passed'),
  buildGridRow('passed'),
  buildGridRow('passed'),
  buildGridRow('passed'),
  buildGridRow('failed'),
  buildGridRow('failed'),
  buildGridRow('failed'),
  buildGridRow('passed'),
  buildGridRow('passed'),
  buildGridRow('passed'),
  buildGridRow('passed'),
  buildGridRow('passed'),
];

function gridStatusToTagKind(status: string) {
  switch (status) {
    case 'running': {
      return 'primary';
    }
    case 'passed': {
      return 'positive';
    }
    case 'failed': {
      return 'negative';
    }
    default: {
      return 'neutral';
    }
  }
}

function GridTasks(props: { tasks: any[] }) {
  const [css] = useStyletron();
  return (
    <div
      className={css({
        gridColumn: 'span 5',
        padding: '32px 24px',
      })}
    >
      <GridStyledTable role="grid" $gridTemplateColumns="max-content auto auto auto">
        <div role="row" className={css({ display: 'contents' })}>
          <GridStyledHeadCell $sticky={false}>Task</GridStyledHeadCell>
          <GridStyledHeadCell $sticky={false}>Status</GridStyledHeadCell>
          <GridStyledHeadCell $sticky={false}>Last Run</GridStyledHeadCell>
          <GridStyledHeadCell $sticky={false}>Details</GridStyledHeadCell>
        </div>
        {props.tasks.map((task, index) => {
          return (
            <div role="row" key={index} className={css({ display: 'contents' })}>
              <GridStyledBodyCell>{task[0]}</GridStyledBodyCell>
              <GridStyledBodyCell>
                <Tag closeable={false} hierarchy="secondary" kind={gridStatusToTagKind(task[1])}>
                  {task[1]}
                </Tag>
              </GridStyledBodyCell>
              <GridStyledBodyCell>{format(task[2], 'yyyy-MM-dd h:mm a')}</GridStyledBodyCell>
              <GridStyledBodyCell>
                <StyledLink href={task[4]}>{task[3]}</StyledLink>
              </GridStyledBodyCell>
            </div>
          );
        })}
      </GridStyledTable>
    </div>
  );
}

const GridCenteredBodyCell = withStyle(GridStyledBodyCell, {
  display: 'flex',
  alignItems: 'center',
});

function GridRow({ striped, row }: any) {
  const [css] = useStyletron();
  const [expanded, setExpanded] = React.useState(false);
  return (
    <div role="row" className={css({ display: 'contents' })}>
      <GridCenteredBodyCell $striped={striped}>
        <Button
          size="compact"
          kind="tertiary"
          onClick={() => setExpanded(!expanded)}
          shape="square"
        >
          {expanded ? <ChevronDown size={18} /> : <ChevronRight size={18} />}
        </Button>
        {row[0]}
      </GridCenteredBodyCell>
      <GridCenteredBodyCell $striped={striped}>
        <Tag closeable={false} hierarchy="secondary" kind={gridStatusToTagKind(row[1])}>
          {row[1]}
        </Tag>
      </GridCenteredBodyCell>
      <GridCenteredBodyCell $striped={striped}>
        <StyledLink href={row[4]}>{row[3]}</StyledLink>
      </GridCenteredBodyCell>
      <GridCenteredBodyCell $striped={striped}>
        {format(row[2], 'yyyy-MM-dd h:mm a')}
      </GridCenteredBodyCell>
      <GridCenteredBodyCell $striped={striped}>
        <div
          className={css({
            textOverflow: 'ellipsis',
            maxWidth: '200px',
            overflow: 'hidden',
            whiteSpace: 'nowrap',
          })}
        >
          {row[5]}
        </div>
        <StatefulPopover
          placement={PLACEMENT.bottomLeft}
          content={({ close }) => (
            <StatefulMenu
              items={[
                { label: 'Item One' },
                { label: 'Item Two' },
                { label: 'Item Three' },
                { label: 'Item Four' },
              ]}
              onItemSelect={() => close()}
              overrides={{
                List: { style: { height: '144px', width: '138px' } },
              }}
            />
          )}
        >
          <Button shape="square" kind="tertiary" size="compact">
            <Overflow size={18} />
          </Button>
        </StatefulPopover>
      </GridCenteredBodyCell>
      {expanded && <GridTasks tasks={row[6]} />}
    </div>
  );
}

function GridTableNestedExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '600px' })}>
      <GridStyledTable
        role="grid"
        $gridTemplateColumns="max-content min-content minmax(300px, max-content) max-content auto"
      >
        <div role="row" className={css({ display: 'contents' })}>
          <GridStyledHeadCell>Job Name</GridStyledHeadCell>
          <GridStyledHeadCell>Status</GridStyledHeadCell>
          <GridStyledHeadCell>Pull Request</GridStyledHeadCell>
          <GridStyledHeadCell>Last Run</GridStyledHeadCell>
          <GridStyledHeadCell>Details</GridStyledHeadCell>
        </div>
        {GRID_NESTED_DATA.map((row, index) => {
          const striped = index % 2 === 0;
          return <GridRow key={index} row={row} striped={striped} />;
        })}
      </GridStyledTable>
    </div>
  );
}

/* ── table-grid/cell-span.tsx ── */
const gridEventsRow: Array<any> = [
  'feat(docs-site): theme editor POC',
  'https://github.com/uber/baseweb/pull/1296',
  [
    [new Date(2019, 6, 22), 'jh3y added a commit'],
    [new Date(2019, 6, 22), 'chasestarr left a comment'],
    [new Date(2019, 6, 22), 'jh3y left a comment'],
    [new Date(2019, 6, 22), 'chasestarr left a comment'],
    [new Date(2019, 6, 22), 'chasestarr left a comment'],
    [new Date(2019, 6, 22), 'jh3y added a commit'],
    [new Date(2019, 6, 22), 'jh3y added a commit'],
    [new Date(2019, 6, 22), 'jh3y marked this pull request as ready'],
  ],
];

const GRID_EVENTS_DATA = [gridEventsRow, gridEventsRow, gridEventsRow];

function GridTableCellSpanExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '600px' })}>
      <GridStyledTable $gridTemplateColumns="minmax(300px, 500px) repeat(2, max-content)">
        <GridStyledHeadCell>Name</GridStyledHeadCell>
        <GridStyledHeadCell>Date</GridStyledHeadCell>
        <GridStyledHeadCell>Event</GridStyledHeadCell>
        {GRID_EVENTS_DATA.map((row, rowIndex) => {
          return (
            <React.Fragment key={rowIndex}>
              <GridStyledBodyCell $gridRow={`span ${row[2].length}`}>
                <StyledLink href={String(row[1])}>{row[0]}</StyledLink>
              </GridStyledBodyCell>
              {(row[2] as any[]).map((event: [Date, string], index: number) => {
                const striped = index % 2 === 0;
                return (
                  <React.Fragment key={index}>
                    <GridStyledBodyCell $striped={striped}>
                      {format(event[0], 'yyyy-MM-dd h:mm a')}
                    </GridStyledBodyCell>
                    <GridStyledBodyCell $striped={striped}>{event[1]}</GridStyledBodyCell>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </GridStyledTable>
    </div>
  );
}

/* ── table-grid/sortable.tsx ── */
const GRID_SORTABLE_DATA: Array<Array<any>> = [
  ['Marlyn', 10],
  ['Luther', 15],
  ['Kiera', 13],
  ['Edna', 20],
  ['Soraya', 18],
  ['Dorris', 32],
  ['Astrid', 26],
  ['Wendie', 17],
  ['Marna', 11],
  ['Malka', 14],
  ['Jospeh', 10],
  ['Roselee', 12],
  ['Justine', 35],
  ['Marlon', 30],
  ['Mellissa', 32],
  ['Fausto', 21],
  ['Alfredia', 22],
  ['Abel', 18],
  ['Winford', 19],
  ['Neil', 27],
];

class GridTableSortableExample extends React.Component<any, any> {
  state = { nameDirection: null, ageDirection: null };
  handleSort = (title: string, prevDirection: string | null | undefined) => {
    let nextDirection = null;
    if (prevDirection === SORT_DIRECTION.ASC) {
      nextDirection = SORT_DIRECTION.DESC;
    }
    if (prevDirection === SORT_DIRECTION.DESC) {
      nextDirection = null;
    }
    if (prevDirection === null) {
      nextDirection = SORT_DIRECTION.ASC;
    }

    if (title === 'name') {
      this.setState({
        nameDirection: nextDirection,
        ageDirection: null,
      });
      return;
    }

    if (title === 'age') {
      this.setState({
        nameDirection: null,
        ageDirection: nextDirection,
      });
      return;
    }
  };

  getSortedData = () => {
    if (this.state.nameDirection) {
      const sorted = GRID_SORTABLE_DATA.slice(0).sort((a, b) => a[0].localeCompare(b[0]));

      if (this.state.nameDirection === SORT_DIRECTION.ASC) {
        return sorted;
      }

      if (this.state.nameDirection === SORT_DIRECTION.DESC) {
        return sorted.reverse();
      }
    }

    if (this.state.ageDirection) {
      const sorted = GRID_SORTABLE_DATA.slice(0).sort((a, b) => a[1] - b[1]);
      if (this.state.ageDirection === SORT_DIRECTION.ASC) {
        return sorted;
      }

      if (this.state.ageDirection === SORT_DIRECTION.DESC) {
        return sorted.reverse();
      }
    }

    return GRID_SORTABLE_DATA;
  };

  render() {
    return (
      <GridStyledTable role="grid" $gridTemplateColumns="repeat(2,1fr)">
        <div role="row" style={{ display: 'contents' }}>
          <GridSortableHeadCell
            title="Name"
            direction={this.state.nameDirection}
            onSort={() => this.handleSort('name', this.state.nameDirection)}
          />
          <GridSortableHeadCell
            disabled={false}
            title="Age"
            direction={this.state.ageDirection}
            onSort={() => this.handleSort('age', this.state.ageDirection)}
            overrides={{
              // Uber's file writes color:'blue' here. A raw hue is a literal the theme cannot
              // reach, so the override takes the theme's accent and demonstrates the same seam.
              HeadCell: { style: ({ $theme }: any) => ({ color: $theme.colors.accent }) },
            }}
          />
        </div>
        {this.getSortedData().map((row, rowIndex) => (
          <div role="row" key={rowIndex} style={{ display: 'contents' }}>
            {row.map((cell, cellIndex) => (
              <GridStyledBodyCell key={cellIndex}>{cell}</GridStyledBodyCell>
            ))}
          </div>
        ))}
      </GridStyledTable>
    );
  }
}

/* ── table-grid/cell-navigation.tsx ── */
function useGridCellNavigation() {
  const cells = React.useRef([]);
  const [columnIndex, setColumnIndex] = React.useState(0);
  const [rowIndex, setRowIndex] = React.useState(0);

  function cellAtCoordinates(column: number, row: number) {
    const candidateRow = cells.current[row];
    if (candidateRow) {
      return candidateRow[column];
    }
    return undefined;
  }

  function register(ref: any, column: number, row: number) {
    if (!cells.current[row]) {
      // @ts-ignore
      cells.current[row] = [];
    }
    // @ts-ignore
    cells.current[row][column] = ref;
  }

  const addressableCell = React.useMemo(() => {
    return cellAtCoordinates(columnIndex, rowIndex);
  }, [columnIndex, rowIndex]);

  const mounted = React.useRef(false);
  React.useEffect(() => {
    if (mounted.current) {
      // @ts-ignore
      if (addressableCell && addressableCell.focus) {
        // @ts-ignore
        addressableCell.focus();
      }
    }
    mounted.current = true;
  }, [addressableCell, mounted.current]);

  function isInBounds(column: number, row: number) {
    return (
      row >= 0 &&
      row < cells.current.length &&
      column >= 0 &&
      cells.current[0] &&
      // @ts-ignore
      column < cells.current[0].length
    );
  }

  const UP = [0, -1];
  const RIGHT = [1, 0];
  const DOWN = [0, 1];
  const LEFT = [-1, 0];

  function nextInDirection(origin: any, direction: any): any {
    function vAdd(a: any, b: any) {
      return [a[0] + b[0], a[1] + b[1]];
    }
    let next = vAdd(origin, direction);
    while (isInBounds(next[0], next[1])) {
      const exists = cellAtCoordinates(next[0], next[1]);
      if (exists) {
        return next;
      } else {
        next = vAdd(next, direction);
      }
    }

    const priorityUp = vAdd(vAdd(origin, direction), UP);
    if (isInBounds(priorityUp[0], priorityUp[1])) {
      return nextInDirection(vAdd(origin, direction), UP);
    }

    const priorityLeft = vAdd(vAdd(origin, direction), LEFT);
    if (isInBounds(priorityLeft[0], priorityLeft[1])) {
      return nextInDirection(vAdd(origin, direction), LEFT);
    }

    return null;
  }

  function handleKeyDown(event: React.KeyboardEvent) {
    let direction = [0, 0];
    switch (event.key) {
      case 'ArrowUp':
        event.preventDefault();
        direction = UP;
        break;
      case 'ArrowRight':
        event.preventDefault();
        direction = RIGHT;
        break;
      case 'ArrowDown':
        event.preventDefault();
        direction = DOWN;
        break;
      case 'ArrowLeft':
        event.preventDefault();
        direction = LEFT;
        break;
      default:
        break;
    }

    const next = nextInDirection([columnIndex, rowIndex], direction);
    if (next) {
      setColumnIndex(next[0]);
      setRowIndex(next[1]);
    }
  }

  const getCellProps = React.useMemo(() => {
    return function (column: number, row: number) {
      const isAddressable = column === columnIndex && row === rowIndex;
      return {
        ref: (r: any) => register(r, column, row),
        tabIndex: isAddressable ? 0 : -1,
        onFocus: () => {
          setColumnIndex(column);
          setRowIndex(row);
        },
        onKeyDown: isAddressable ? handleKeyDown : undefined,
        $isFocusVisible: isAddressable,
      };
    };
  }, [columnIndex, rowIndex]);

  return { getCellProps };
}

function GridTableCellNavigationExample() {
  const { getCellProps } = useGridCellNavigation();
  const [css] = useStyletron();
  return (
    <div className={css({ height: '600px' })}>
      <GridStyledTable
        tabIndex={0}
        role="grid"
        $gridTemplateColumns="minmax(300px, 500px) repeat(2, max-content)"
      >
        <GridStyledHeadCell {...getCellProps(0, 0)}>Name</GridStyledHeadCell>
        <GridStyledHeadCell {...getCellProps(1, 0)}>Date</GridStyledHeadCell>
        <GridStyledHeadCell {...getCellProps(2, 0)}>Event</GridStyledHeadCell>

        {GRID_EVENTS_DATA.map((row, rowIndex) => {
          const events = row[2] as Array<any>;
          const primaryRowIndex = rowIndex * events.length + 1;
          return (
            <React.Fragment key={rowIndex}>
              <GridStyledBodyCell
                {...getCellProps(0, primaryRowIndex)}
                $gridRow={`span ${row[2].length}`}
              >
                <StyledLink href={String(row[1])}>{row[0]}</StyledLink>
              </GridStyledBodyCell>
              {events.map((event: [Date, string], index: number) => {
                const striped = index % 2 === 0;
                return (
                  <React.Fragment key={index}>
                    <GridStyledBodyCell
                      {...getCellProps(1, primaryRowIndex + rowIndex)}
                      $striped={striped}
                    >
                      {format(event[0], 'yyyy-MM-dd h:mm a')}
                    </GridStyledBodyCell>
                    <GridStyledBodyCell
                      {...getCellProps(2, primaryRowIndex + rowIndex)}
                      $striped={striped}
                    >
                      {event[1]}
                    </GridStyledBodyCell>
                  </React.Fragment>
                );
              })}
            </React.Fragment>
          );
        })}
      </GridStyledTable>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * DATA TABLE — six examples
 *
 * The custom column in Uber's basic / customized-column-sort examples paints a swatch from a
 * hand-picked paint chart. Here the value names a shade of Base's own mono ramp and the swatch
 * resolves it from the theme — the demonstration (an arbitrary renderer, filter and sort inside a
 * strict column) is Uber's, the palette is Base's.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

type Shade = 'mono400' | 'mono600' | 'mono800' | 'mono900' | 'mono1000';
type ColorValue = { color: Shade };

/* ── data-table/basic.tsx ── */
// https://gist.github.com/6174/6062387
function pseudoRandomString(rowIdx: any, columnIdx: any) {
  return (
    (0.88 * rowIdx).toString(36).replace('.', '').substring(2) +
    (0.99 * columnIdx).toString(36).replace('.', '')
  ).slice(0, 10);
}

function makeRowsFromColumns(columns: any, rowCount: number) {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      id: i,
      data: columns.map((column: any, j: number) => {
        switch (column.kind) {
          case COLUMNS.CATEGORICAL:
            switch (i % 5) {
              case 4:
                return 'A';
              case 3:
                return 'B';
              case 2:
                return 'C';
              case 1:
                return 'D';
              case 0:
              default:
                return 'F';
            }
          case COLUMNS.NUMERICAL:
            return i % 2 ? i - 1 : i + 3;
          case COLUMNS.BOOLEAN:
            return i % 2 === 0;
          case COLUMNS.STRING:
            return pseudoRandomString(i, j);
          case COLUMNS.CUSTOM:
            switch (i % 5) {
              case 4:
                return { color: 'mono400' };
              case 3:
                return { color: 'mono600' };
              case 2:
                return { color: 'mono800' };
              case 1:
                return { color: 'mono900' };
              case 0:
              default:
                return { color: 'mono1000' };
            }
          default:
            return 'default' + pseudoRandomString(i, j);
        }
      }),
    });
  }
  return rows;
}

type DataTableRow = [string, string, number, number, number, ColorValue, boolean, string];

const dataTableBasicColumns = [
  CategoricalColumn({
    title: 'categorical',
    mapDataToValue: (data: DataTableRow) => data[0],
  }),
  StringColumn({
    title: 'string',
    mapDataToValue: (data: DataTableRow) => data[1],
  }),
  NumericalColumn({
    title: 'three',
    mapDataToValue: (data: DataTableRow) => data[2],
  }),
  NumericalColumn({
    title: 'neg std',
    highlight: (n: number) => n < 0,
    mapDataToValue: (data: DataTableRow) => data[3],
  }),
  NumericalColumn({
    title: 'accounting',
    format: NUMERICAL_FORMATS.ACCOUNTING,
    mapDataToValue: (data: DataTableRow) => data[4],
  }),
  CustomColumn<ColorValue, {}>({
    title: 'custom color',
    mapDataToValue: (data: DataTableRow) => data[5],
    renderCell: function Cell(props: any) {
      const [css, theme] = useStyletron();
      return (
        <div
          className={css({
            alignItems: 'center',
            // Uber writes '"Comic Sans MS", cursive, sans-serif' here to prove the cell is
            // entirely yours. It stays entirely ours, on the theme's own mono face.
            ...theme.typography.MonoParagraphSmall,
            display: 'flex',
          })}
        >
          <div
            className={css({
              backgroundColor: theme.colors[props.value.color as Shade],
              height: '12px',
              marginRight: '24px',
              width: '12px',
            })}
          />
          <div>{props.value.color}</div>
        </div>
      );
    },
  }),
  BooleanColumn({
    title: 'boolean',
    mapDataToValue: (data: DataTableRow) => data[6],
  }),
  CategoricalColumn({
    title: 'second category',
    mapDataToValue: (data: DataTableRow) => data[7],
  }),
];

const dataTableBasicRows = makeRowsFromColumns(dataTableBasicColumns, 2000);

function DataTableBasicExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '800px' })}>
      <StatefulDataTable columns={dataTableBasicColumns} rows={dataTableBasicRows} />
    </div>
  );
}

/* ── data-table/batch-action.tsx ── */
type BatchRowData = [string, boolean, string, number, number, number, number];

const dataTableBatchColumns = [
  StringColumn({
    title: 'Movie',
    mapDataToValue: (data: BatchRowData) => data[0],
  }),
  BooleanColumn({
    title: 'is it good?',
    mapDataToValue: (data: BatchRowData) => data[1],
  }),
  CategoricalColumn({
    title: 'Genre',
    mapDataToValue: (data: BatchRowData) => data[2],
  }),
  NumericalColumn({
    title: 'Production Budget (millions)',
    format: NUMERICAL_FORMATS.ACCOUNTING,
    mapDataToValue: (data: BatchRowData) => data[3],
  }),
  NumericalColumn({
    title: 'Box Office (millions)',
    format: NUMERICAL_FORMATS.ACCOUNTING,
    mapDataToValue: (data: BatchRowData) => data[4],
  }),
  NumericalColumn({
    title: 'ROI',
    precision: 2,
    mapDataToValue: (data: BatchRowData) => data[5],
  }),
  NumericalColumn({
    title: 'Rating IMDB',
    precision: 2,
    mapDataToValue: (data: BatchRowData) => data[6],
  }),
];

const dataTableBatchInitialRows = [
  ['Avatar', false, 'Action', 237, 2784, 11.7, 8.0],
  ['The Blind Side', false, 'Drama', 29, 309, 10.7, 7.6],
  ['The Dark Knight', false, 'Action', 185, 1005, 5.4, 9.0],
  ['ET: The Extra-Terrestrial', false, 'Drama', 11, 793, 75.5, 7.9],
  ['Finding Nemo', false, 'Adventure', 94, 940, 10.0, 8.1],
  ['Ghostbusters', false, 'Comedy', 144, 229, 1.6, 7.8],
  ['The Hunger Games', false, 'Thriller/Suspense', 78, 649, 8.3, 7.2],
  ['Iron Man 3', false, 'Action', 178, 1215, 6.8, 7.6],
  ['Jurassic Park', false, 'Action', 53, 1030, 19.4, 8.0],
  ['King Kong', false, 'Adventure', 207, 551, 2.7, 7.3],
  ['The Lion King', false, 'Adventure', 115, 577, 5.0, 8.0],
  ['Monsters, Inc.', false, 'Adventure', 115, 577, 5.0, 8.0],
  ['The Twilight Saga: New Moon', false, 'Drama', 50, 710, 14.2, 4.5],
  ['Oz the Great and Powerful', false, 'Adventure', 160, 493, 3.1, 6.6],
  [`Pirates of the Caribbean: Dead Man's Chest`, false, 'Adventure', 225, 1066, 4.7, 7.3],
  ['Quantum of Solace', false, 'Action', 200, 586, 2.9, 6.7],
  ['Raiders of the Lost Ark', false, 'Adventure', 18, 390, 21.7, 8.7],
  ['Star Wars Ep. I: The Phantom Menace', false, 'Adventure', 115, 1027, 8.9, 6.5],
  ['Titanic', false, 'Thriller/Suspense', 200, 2187, 10.9, 7.6],
  ['Up', false, 'Adventure', 175, 735, 4.2, 8.3],
  ['The Vow', false, 'Drama', 30, 196, 6.5, 6.7],
  ['The War of the Worlds', false, 'Action', 132, 704, 5.3, 6.5],
  ['X-Men: The Last Stand', false, 'Action', 210, 459, 2.2, 6.8],
  [`You've Got Mail`, false, 'Drama', 65, 251, 3.9, 6.3],
  ['Zookeeper', false, 'Romantic Comedy', 80, 170, 2.1, 5.0],
].map((r) => ({ id: String(r[0]), data: r }));

function DataTableBatchActionExample() {
  const [rows, setRows] = React.useState(dataTableBatchInitialRows);

  function flagRows(ids: Array<string | number>) {
    const nextRows = rows.map((row) => {
      if (ids.includes(row.id)) {
        const nextData = [...row.data];
        nextData[1] = !nextData[1];
        return { ...row, data: nextData };
      }

      return row;
    });
    setRows(nextRows);
  }
  function flagRow(id: string | number) {
    flagRows([id]);
  }

  function removeRows(ids: Array<string | number>) {
    const nextRows = rows.filter((row) => !ids.includes(row.id));
    setRows(nextRows);
  }
  function removeRow(id: string | number) {
    removeRows([id]);
  }

  const batchActions: BatchAction[] = [
    {
      label: 'Check',
      onClick: ({ selection, clearSelection }) => {
        flagRows(selection.map((r) => r.id));
        clearSelection();
      },
      renderIcon: Check,
    },
    {
      label: 'Remove',
      onClick: ({ selection, clearSelection }) => {
        removeRows(selection.map((r) => r.id));
        clearSelection();
      },
      renderIcon: Alert,
    },
    {
      label: 'Download',
      onClick: ({ clearSelection }) => clearSelection(),
    },
  ];

  const rowActions: RowAction[] = [
    {
      label: 'Check',
      onClick: ({ row }) => flagRow(row.id),
      renderIcon: Check,
    },
    {
      label: 'Remove',
      onClick: ({ row }) => removeRow(row.id),
      renderIcon: Alert,
    },
  ];

  return (
    <div style={{ height: '300px' }}>
      <StatefulDataTable
        batchActions={batchActions}
        rowActions={rowActions}
        columns={dataTableBatchColumns}
        rows={rows}
      />
    </div>
  );
}

/* ── data-table/row-height-line-clamp.tsx ── */
type LineClampRowData = {
  title: string;
  loremIpsum: string;
  genre: string;
  budget: number;
  boxOffice: number;
  roi: number;
  imdb: number;
};

const loremIpsum = `"We went upstairs together, the colonel first with the lamp, the fat manager and I behind him. It was a labyrinth of an old house, with corridors, passages, narrow winding staircases, and little low doors, the thresholds of which were hollowed out by the generations who had crossed them. There were no carpets and no signs of any furniture above the ground floor, while the plaster was peeling off the walls, and the damp was breaking through in green, unhealthy blotches. I tried to put on as unconcerned an air as possible, but I had not forgotten the warnings of the lady, even though I disregarded them, and I kept a keen eye upon my two companions. Ferguson appeared to be a morose and silent man, but I could see from the little that he said that he was at least a fellow-countryman.`;

const dataTableLineClampColumns = [
  StringColumn({
    title: 'Movie Title',
    mapDataToValue: (data: LineClampRowData) => data.title,
  }),
  StringColumn({
    title: 'Lorem Ipsum Description',
    maxWidth: 300,
    lineClamp: 3,
    mapDataToValue: (data: LineClampRowData) => data.loremIpsum,
  }),
  CategoricalColumn({
    title: 'Genre',
    mapDataToValue: (data: LineClampRowData) => data.genre,
  }),
  NumericalColumn({
    title: 'Production Budget (millions)',
    format: NUMERICAL_FORMATS.ACCOUNTING,
    mapDataToValue: (data: LineClampRowData) => data.budget,
  }),
  NumericalColumn({
    title: 'Box Office (millions)',
    format: NUMERICAL_FORMATS.ACCOUNTING,
    mapDataToValue: (data: LineClampRowData) => data.boxOffice,
  }),

  NumericalColumn({
    title: 'ROI',
    precision: 2,
    mapDataToValue: (data: LineClampRowData) => data.roi,
  }),
  NumericalColumn({
    title: 'Rating IMDB',
    precision: 2,
    mapDataToValue: (data: LineClampRowData) => data.imdb,
  }),
];

// Uber's file repeats the twenty-five films of batch-action, one field per column; here it reads
// them off that array instead.
const dataTableLineClampRows = dataTableBatchInitialRows.map((r) => {
  const data = r.data as BatchRowData;
  return {
    id: data[0],
    data: {
      title: data[0],
      loremIpsum,
      genre: data[2],
      budget: data[3],
      boxOffice: data[4],
      roi: data[5],
      imdb: data[6],
    },
  };
});

function DataTableLineClampExample() {
  return (
    <div style={{ height: '600px' }}>
      <StatefulDataTable
        columns={dataTableLineClampColumns}
        rows={dataTableLineClampRows}
        rowHeight={78}
      />
    </div>
  );
}

/* ── data-table/customized-column-sort.tsx ── */
function makeSortableRowsFromColumns(columns: any, rowCount: number) {
  const rows = [];
  for (let i = 0; i < rowCount; i++) {
    rows.push({
      id: i,
      data: columns.map((column: any, j: number) => {
        switch (column.kind) {
          case COLUMNS.CATEGORICAL:
            switch (i % 11) {
              case 11:
                return 'UberX';
              case 10:
                return 'UberXL';
              case 9:
                return 'Uber Select';
              case 8:
                return 'Uber Comfort';
              case 7:
                return 'Uber Pool';
              case 6:
                return 'Uber Black';
              case 5:
                return 'Uber Assist';
              case 4:
                return 'Uber WAV';
              case 3:
                return 'Transit';
              case 2:
                return 'Taxi';
              case 1:
                return 'Bike';
              case 0:
              default:
                return 'Scooter';
            }
          case COLUMNS.NUMERICAL:
            return i % 2 ? i - 1 : i + 3;
          case COLUMNS.STRING:
            return pseudoRandomString(i, j);
          case COLUMNS.CUSTOM:
            switch (i % 5) {
              case 4:
                return { color: 'mono400' };
              case 3:
                return { color: 'mono600' };
              case 2:
                return { color: 'mono800' };
              case 1:
                return { color: 'mono900' };
              case 0:
              default:
                return { color: 'mono1000' };
            }
          default:
            return pseudoRandomString(i, j);
        }
      }),
    });
  }
  return rows;
}

type SortableRowData = [string, ColorValue, string, number];

const dataTableSortableColumns = [
  CategoricalColumn({
    title: 'categorical',
    mapDataToValue: (data: SortableRowData) => data[0],
  }),
  CustomColumn<ColorValue, { selection: Set<string>; exclude: boolean; description: string }>({
    title: 'custom color (sortable)',
    filterable: true,
    sortable: true,
    minWidth: 120,
    mapDataToValue: (data: SortableRowData) => data[1],
    renderCell: function Cell(props: any) {
      const [css, theme] = useStyletron();
      return (
        <div
          className={css({
            alignItems: 'center',
            ...theme.typography.MonoParagraphSmall,
            display: 'flex',
          })}
        >
          <div
            className={css({
              backgroundColor: theme.colors[props.value.color as Shade],
              height: '12px',
              marginRight: '24px',
              width: '12px',
            })}
          />
          <div>{props.value.color}</div>
        </div>
      );
    },
    renderFilter: function ColorFilter(props: any) {
      const [css, theme] = useStyletron();
      const [selection, setSelection] = React.useState(new Set());
      const colors = React.useMemo(() => {
        return props.data.reduce((set: any, item: any) => set.add(item.color), new Set());
      }, [props.data]);

      return (
        <div>
          <ul>
            {Array.from(colors).map((color: any) => {
              return (
                <li key={color} className={css({ backgroundColor: theme.colors[color as Shade] })}>
                  <input
                    type="checkbox"
                    onChange={() => {
                      if (selection.has(color)) {
                        selection.delete(color);
                      } else {
                        selection.add(color);
                      }
                      setSelection(selection);
                    }}
                  />
                  <span className={css({ paddingLeft: '8px' })}>{color}</span>
                </li>
              );
            })}
          </ul>
          <button
            onClick={() => {
              props.setFilter({
                selection,
                description: Array.from(selection).join(', '),
                exclude: false,
              });
              props.close();
            }}
          >
            apply
          </button>
        </div>
      );
    },
    buildFilter: function (params: any) {
      return function (data: any) {
        return params.selection.has(data.color);
      };
    },
    sortFn: function (a: any, b: any) {
      return a.color.localeCompare(b.color);
    },
  }),
  StringColumn({
    title: 'string',
    mapDataToValue: (data: SortableRowData) => data[2],
  }),
  NumericalColumn({
    title: 'accounting',
    format: NUMERICAL_FORMATS.ACCOUNTING,
    mapDataToValue: (data: SortableRowData) => data[3],
  }),
];

const dataTableSortableRows = makeSortableRowsFromColumns(dataTableSortableColumns, 100);

function DataTableCustomizedColumnSortExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ height: '800px' })}>
      <StatefulDataTable columns={dataTableSortableColumns} rows={dataTableSortableRows} />
    </div>
  );
}

/* ── data-table/customized-empty-state.tsx ── */
// Uber's file repeats the eight columns of data-table/basic; here it reads them.
function DataTableCustomizedEmptyStateExample() {
  const [css] = useStyletron();
  return (
    <React.Fragment>
      <div className={css({ height: '400px' })}>
        <StatefulDataTable
          columns={dataTableBasicColumns}
          rows={[]}
          emptyMessage="custom empty message"
        />
      </div>
      <div className={css({ height: '400px' })}>
        <StatefulDataTable
          columns={dataTableBasicColumns}
          rows={[]}
          emptyMessage={() => <h1>custom empty component</h1>}
        />
      </div>
    </React.Fragment>
  );
}

/* ── data-table/access-table-data.tsx ── */
type AccessRowData = [boolean, string, number, string];

const dataTableAccessColumns = [
  BooleanColumn({
    title: 'boolean',
    mapDataToValue: (data: AccessRowData) => data[0],
  }),

  CategoricalColumn({
    title: 'color',
    mapDataToValue: (data: AccessRowData) => data[1],
  }),

  NumericalColumn({
    title: 'number',
    mapDataToValue: (data: AccessRowData) => data[2],
  }),

  StringColumn({
    title: 'description',
    mapDataToValue: (data: AccessRowData) => data[3],
  }),
];

const dataTableAccessRows = [
  { id: 1, data: [true, 'green', 2, 'bright'] },
  { id: 2, data: [false, 'blue', 1, 'glossy'] },
  { id: 3, data: [true, 'black', 4, 'dry'] },
  { id: 4, data: [false, 'pink', 3, 'brittle'] },
  { id: 5, data: [false, 'blue', 5, 'big'] },
  { id: 6, data: [true, 'pink', 6, 'spicey'] },
  { id: 7, data: [false, 'blue', 3, 'mild'] },
  { id: 8, data: [false, 'blue', 3, 'pointy'] },
  { id: 9, data: [true, 'blue', 3, 'soft'] },
  { id: 10, data: [false, 'pink', 1, 'worn'] },
  { id: 11, data: [true, 'blue', 1, 'brittle'] },
  { id: 12, data: [true, 'blue', 3, 'glossy'] },
  { id: 13, data: [false, 'purple', 3, 'big'] },
  { id: 14, data: [false, 'blue', 1, 'worn'] },
  { id: 15, data: [false, 'blue', 3, 'dry'] },
  { id: 16, data: [false, 'orange', 5, 'spicey'] },
  { id: 17, data: [false, 'orange', 7, 'big'] },
  { id: 18, data: [false, 'blue', 8, 'glossy'] },
  { id: 19, data: [false, 'magenta', 4, 'brittle'] },
  { id: 20, data: [true, 'blue', 3, 'dry'] },
];

function DataTableAccessTableDataExample() {
  const [css] = useStyletron();
  const controlRef = React.useRef<ImperativeMethods>(null);
  const handleClick = () => {
    const rows = controlRef.current?.getRows();
    if (Array.isArray(rows)) {
      console.log(rows);
    }
  };
  return (
    <>
      <Button onClick={handleClick}>Log filtered and sorted records to console</Button>
      <div className={css({ height: '800px' })}>
        <StatefulDataTable
          columns={dataTableAccessColumns}
          rows={dataTableAccessRows}
          controlRef={controlRef}
        />
      </div>
    </>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * PAGINATION — four examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* ── pagination/controlled.tsx ── */
function PaginationControlledExample() {
  const [currentPage, setCurrentPage] = React.useState(1);
  return (
    <Pagination
      numPages={20}
      currentPage={currentPage}
      onPageChange={({ nextPage }) => {
        setCurrentPage(Math.min(Math.max(nextPage, 1), 20));
      }}
    />
  );
}

/* ── pagination/uncontrolled.tsx ── */
function PaginationUncontrolledExample() {
  return <StatefulPagination numPages={10} />;
}

/* ── pagination/labels.tsx ── */
function PaginationLabelsExample() {
  return (
    <StatefulPagination
      numPages={10}
      labels={{
        prevButton: 'Back',
        nextButton: 'Forward',
        preposition: 'out of',
      }}
    />
  );
}

/* ── pagination/overrides.tsx ── */
function PaginationOverridesExample() {
  return (
    <StatefulPagination
      numPages={10}
      overrides={{
        Root: {
          style: ({ $theme }) => ({
            ...expandBorderStyles($theme.borders.border400),
            borderTopLeftRadius: $theme.borders.radius200,
            borderTopRightRadius: $theme.borders.radius200,
            borderBottomRightRadius: $theme.borders.radius200,
            borderBottomLeftRadius: $theme.borders.radius200,
            padding: $theme.sizing.scale400,
          }),
        },
        PrevButton: {
          component: ({ onClick }: any) => <Button onClick={onClick}>Left</Button>,
        },
        NextButton: {
          component: ({ onClick }: any) => <Button onClick={onClick}>Right</Button>,
        },
        MaxLabel: {
          style: ({ $theme }) => ({
            ...$theme.typography.font300,
            marginRight: $theme.sizing.scale1000,
          }),
        },
        DropdownContainer: {
          style: ({ $theme }) => ({
            marginLeft: $theme.sizing.scale1000,
          }),
        },
        Select: {
          props: {
            overrides: {
              ControlContainer: {
                style: ({ $theme, $disabled, $isFocused, $isPseudoFocused, $error }: any) => ({
                  borderLeftColor: 'transparent',
                  borderRightColor: 'transparent',
                  borderTopColor: 'transparent',
                  borderBottomColor: 'transparent',
                  boxShadow: 'none',
                  backgroundColor: $disabled
                    ? $theme.colors.buttonDisabledFill
                    : $isFocused || $isPseudoFocused
                      ? $theme.colors.buttonSecondaryHover
                      : $error
                        ? $theme.colors.negative50
                        : $theme.colors.buttonSecondaryFill,
                }),
              },
              SingleValue: {
                style: ({ $theme }: any) => ({
                  position: 'relative',
                  paddingTop: '0',
                  paddingBottom: '0',
                  paddingLeft: $theme.sizing.scale200,
                  paddingRight: $theme.sizing.scale500,
                  color: $theme.colors.buttonTertiaryText,
                  ...$theme.typography.font350,
                }),
              },
              SelectArrow: {
                style: ({ $theme }: any) => ({
                  width: '24px',
                  height: '24px',
                  color: $theme.colors.buttonTertiaryText,
                }),
              },
            },
          },
        },
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TREE VIEW — seven examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* ── tree-view/basic.tsx ── */
const treeBasicInitialData: TreeNodeData[] = [
  {
    id: 1,
    label: 'Projects',
    isExpanded: true,
    children: [
      {
        id: 2,
        label: 'project-1.docx',
      },
      {
        id: 3,
        label: 'project-2.docx',
      },
      {
        id: 4,
        label: 'Project 3',
        isExpanded: false,
        children: [
          {
            id: 5,
            label: 'project-3A.docx',
          },
          {
            id: 6,
            label: 'project-3B.docx',
          },
          {
            id: 7,
            label: 'project-3C.docx',
          },
        ],
      },
      {
        id: 8,
        label: 'project-4.docx',
      },
      {
        id: 9,
        label: 'Project 5',
        isExpanded: false,
        children: [
          {
            id: 10,
            label: 'project-5A.docx',
          },
          {
            id: 11,
            label: 'project-5B.docx',
          },
        ],
      },
    ],
  },
  {
    id: 12,
    label: 'Reports',
    isExpanded: false,
    children: [
      {
        id: 13,
        label: 'report-1',
        isExpanded: false,
        children: [
          {
            id: 14,
            label: 'report-1A.docx',
          },
          {
            id: 15,
            label: 'report-1B.docx',
          },
        ],
      },
      {
        id: 16,
        label: 'report-2',
        isExpanded: false,
        children: [
          {
            id: 17,
            label: 'report-2A.docx',
          },
          {
            id: 18,
            label: 'report-2B.docx',
          },
        ],
      },
      {
        id: 19,
        label: 'report-3',
        isExpanded: false,
        children: [
          {
            id: 20,
            label: 'report-3A.docx',
          },
          {
            id: 21,
            label: 'report-3B.docx',
          },
        ],
      },
    ],
  },
];

function TreeViewBasicExample() {
  const [data, setData] = React.useState(treeBasicInitialData);

  return (
    <TreeView data={data} onToggle={(node) => setData((prevData) => toggleIsExpanded(prevData, node))} />
  );
}

/* ── tree-view/custom-label.tsx ── */
const TreeCustomLabelRow = styled('div', {
  display: 'flex',
  flexGrow: 1,
  paddingRight: '5px',
});

const TreeCustomLabelPrice = styled('span', {
  marginLeft: 'auto',
});

const TreeCustomLabel = (node: TreeNodeData) => {
  return (
    <TreeCustomLabelRow>
      <span>{node.info && node.info.name}</span>
      <TreeCustomLabelPrice>{node.info && node.info.price}</TreeCustomLabelPrice>
    </TreeCustomLabelRow>
  );
};

const treeCustomLabelInitialData: TreeNodeData[] = [
  {
    label: TreeCustomLabel,
    isExpanded: true,
    info: { price: '$2', name: 'Coffee' },
    children: [
      {
        label: TreeCustomLabel,
        isExpanded: true,
        info: { price: '$1', name: 'Medium' },
      },
    ],
  },
  {
    label: TreeCustomLabel,
    isExpanded: true,
    info: { price: '$8', name: 'Pizza' },
    children: [
      {
        label: TreeCustomLabel,
        isExpanded: true,
        info: { price: '$2', name: 'Large' },
      },
    ],
  },
];

function TreeViewCustomLabelExample() {
  const [data, setData] = React.useState(treeCustomLabelInitialData);
  const getId = (node: TreeNodeData) => node.info.name;

  return (
    <TreeView
      data={data}
      getId={getId}
      onToggle={(node) => setData((prevData) => toggleIsExpanded(prevData, node, getId))}
    />
  );
}

/* ── tree-view/overrides.tsx ── */
const treeOverridesInitialData: TreeNodeData[] = [
  {
    id: 1,
    label: 'Node 1',
    isExpanded: true,
    children: [
      {
        id: 2,
        label: 'Child 1',
        isExpanded: true,
        children: [
          {
            id: 3,
            label: 'Grandchild 1',
            isExpanded: true,
            children: [
              {
                id: 4,
                label: 'Should be rendered SSR / even when closed (check source!)',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 5,
    label: 'Node 2',
    isExpanded: true,
    children: [
      {
        id: 6,
        label: 'Child 2',
        isExpanded: true,
        children: [
          {
            id: 7,
            label: 'Grandchild 2',
            children: [
              {
                id: 8,
                label: 'Should be rendered SSR / even when closed (check source!)',
              },
            ],
          },
        ],
      },
    ],
  },
];

function TreeViewOverridesExample() {
  const [data, setData] = React.useState(treeOverridesInitialData);

  return (
    <TreeView
      data={data}
      renderAll
      onToggle={(node) => setData((prevData) => toggleIsExpanded(prevData, node))}
      overrides={{
        IconContainer: {
          style: {
            borderLeftStyle: 'solid',
            borderRightStyle: 'solid',
            borderTopStyle: 'solid',
            borderBottomStyle: 'solid',
            borderLeftWidth: '1px',
            borderRightWidth: '1px',
            borderTopWidth: '1px',
            borderBottomWidth: '1px',
            width: '12px',
            height: '12px',
          },
        },
        CollapseIcon: {
          component: CheckIndeterminate,
        },
        ExpandIcon: {
          component: Plus,
        },
        LeafIconContainer: {
          // Uber inverts the leaf icon with a black-on-white pair written as literals. The theme
          // owns that pair, so the override reads it from there and the inversion re-inks.
          style: ({ $theme }: { $theme: Theme }) => ({
            backgroundColor: $theme.colors.backgroundInversePrimary,
            color: $theme.colors.contentInversePrimary,
            width: '20px',
          }),
        },
        LeafIcon: {
          component: Search,
        },
      }}
    />
  );
}

/* ── tree-view/label-overrides.tsx ── */
const TreeDepthLabel = (node: TreeNodeData) => {
  const Tag = ((depth) => {
    switch (depth) {
      case 1:
        return 'h1';
      case 2:
        return 'h2';
      case 3:
      default:
        return 'h3';
    }
  })(node.depth);
  return <Tag>{node.label as React.ReactNode}</Tag>;
};

const TreeDepthTreeLabel = (props: TreeLabelProps) => {
  return (
    <TreeLabel
      {...props}
      label={TreeDepthLabel}
      overrides={{
        CollapseIcon: {
          component: ChevronDown as any,
          props: {
            size: (5 - props.node.depth) * 10,
          },
        },
        ExpandIcon: {
          component: ChevronRight as any,
          props: {
            size: (5 - props.node.depth) * 10,
          },
        },
      }}
    />
  );
};

const treeLabelOverridesInitialData: TreeNodeData[] = [
  {
    id: 1,
    depth: 1,
    label: 'Node 1',
    isExpanded: true,
    children: [
      {
        id: 2,
        depth: 2,
        label: 'Child 1',
        isExpanded: true,
        children: [
          {
            id: 3,
            depth: 3,
            label: 'Grandchild 1',
            isExpanded: true,
            children: [
              {
                id: 4,
                depth: 4,
                label: 'Greatgrandchild 1',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 5,
    depth: 1,
    label: 'Node 2',
    isExpanded: true,
    children: [
      {
        id: 6,
        depth: 2,
        label: 'Child 2',
        isExpanded: true,
        children: [
          {
            id: 7,
            depth: 3,
            label: 'Grandchild 2',
            isExpanded: true,
            children: [
              {
                id: 8,
                depth: 4,
                label: 'Greatgrandchild 2',
              },
            ],
          },
        ],
      },
    ],
  },
];

function TreeViewLabelOverridesExample() {
  const [data, setData] = React.useState(treeLabelOverridesInitialData);

  return (
    <TreeView
      data={data}
      onToggle={(node) => setData((prevData) => toggleIsExpanded(prevData, node))}
      overrides={{
        IconContainer: {
          style: {
            borderLeftStyle: 'none',
            borderRightStyle: 'none',
            borderTopStyle: 'none',
            borderBottomStyle: 'none',
          },
        },
        TreeLabel: {
          component: TreeDepthTreeLabel,
        },
      }}
    />
  );
}

/* ── tree-view/single-expanded.tsx ── */
const treeSingleExpandedInitialData = [
  {
    id: 1,
    label: 'Node 1',
    isExpanded: true,
    children: [
      {
        id: 2,
        label: 'Child 1.1',
        isExpanded: true,
        children: [
          {
            id: 3,
            label: 'Grandchild 1.1.1',
            isExpanded: true,
            children: [
              {
                id: 4,
                label: 'Greatgrandchild 1.1.1.1',
                isExpanded: true,
              },
              {
                id: 5,
                label: 'Greatgrandchild 1.1.1.2',
              },
              {
                id: 6,
                label: 'Greatgrandchild 1.1.1.3',
              },
            ],
          },
          {
            id: 7,
            label: 'Grandchild 1.1.2',
            children: [
              {
                id: 8,
                label: 'Greatgrandchild 1.1.2.1',
              },
              {
                id: 9,
                label: 'Greatgrandchild 1.1.2.2',
              },
              {
                id: 10,
                label: 'Greatgrandchild 1.1.2.3',
              },
            ],
          },
          {
            id: 11,
            label: 'Grandchild 1.1.3',
            children: [
              {
                id: 12,
                label: 'Greatgrandchild 1.1.3.1',
              },
              {
                id: 13,
                label: 'Greatgrandchild 1.1.3.2',
              },
              {
                id: 14,
                label: 'Greatgrandchild 1.1.3.3',
              },
            ],
          },
        ],
      },
      {
        id: 15,
        label: 'Child 1.2',
        children: [
          {
            id: 16,
            label: 'Grandchild 1.2.1',
            isExpanded: true,
            children: [
              {
                id: 17,
                label: 'Greatgrandchild 1.2.1.1',
                isExpanded: true,
              },
              {
                id: 18,
                label: 'Greatgrandchild 1.2.1.2',
              },
              {
                id: 19,
                label: 'Greatgrandchild 1.2.1.3',
              },
            ],
          },
          {
            id: 20,
            label: 'Grandchild 1.2.2',
            children: [
              {
                id: 21,
                label: 'Greatgrandchild 1.2.2.1',
              },
              {
                id: 22,
                label: 'Greatgrandchild 1.2.2.2',
              },
              {
                id: 23,
                label: 'Greatgrandchild 1.2.2.3',
              },
            ],
          },
          {
            id: 24,
            label: 'Grandchild 1.2.3',
            children: [
              {
                id: 25,
                label: 'Greatgrandchild 1.2.3.1',
              },
              {
                id: 26,
                label: 'Greatgrandchild 1.2.3.2',
              },
              {
                id: 27,
                label: 'Greatgrandchild 1.2.3.3',
              },
            ],
          },
        ],
      },
      {
        id: 28,
        label: 'Child 1.3',
        children: [
          {
            id: 29,
            label: 'Grandchild 1.3.1',
            isExpanded: true,
            children: [
              {
                id: 30,
                label: 'Greatgrandchild 1.3.1.1',
                isExpanded: true,
              },
              {
                id: 31,
                label: 'Greatgrandchild 1.3.1.2',
              },
              {
                id: 32,
                label: 'Greatgrandchild 1.3.1.3',
              },
            ],
          },
          {
            id: 33,
            label: 'Grandchild 1.3.2',
            children: [
              {
                id: 34,
                label: 'Greatgrandchild 1.3.2.1',
              },
              {
                id: 35,
                label: 'Greatgrandchild 1.3.2.2',
              },
              {
                id: 36,
                label: 'Greatgrandchild 1.3.2.3',
              },
            ],
          },
          {
            id: 37,
            label: 'Grandchild 1.3.3',
            children: [
              {
                id: 38,
                label: 'Greatgrandchild 1.3.3.1',
              },
              {
                id: 39,
                label: 'Greatgrandchild 1.3.3.2',
              },
              {
                id: 40,
                label: 'Greatgrandchild 1.3.3.3',
              },
            ],
          },
        ],
      },
    ],
  },
  {
    id: 41,
    label: 'Node 2',
    children: [
      {
        id: 42,
        label: 'Child 2.1',
        children: [
          {
            id: 43,
            label: 'Grandchild 2.1.1',
          },
          {
            id: 44,
            label: 'Grandchild 2.1.2',
          },
          {
            id: 45,
            label: 'Grandchild 2.1.3',
          },
        ],
      },
      {
        id: 46,
        label: 'Child 2.2',
        children: [
          {
            id: 47,
            label: 'Grandchild 2.2.1',
          },
          {
            id: 48,
            label: 'Grandchild 2.2.2',
          },
          {
            id: 49,
            label: 'Grandchild 2.2.3',
          },
        ],
      },
      {
        id: 50,
        label: 'Child 2.3',
        children: [
          {
            id: 51,
            label: 'Grandchild 2.3.1',
          },
          {
            id: 52,
            label: 'Grandchild 2.3.2',
          },
          {
            id: 53,
            label: 'Grandchild 2.3.3',
          },
        ],
      },
    ],
  },
];

function TreeViewSingleExpandedExample() {
  return <StatefulTreeView singleExpanded data={treeSingleExpandedInitialData} />;
}

/* ── tree-view/interactable.tsx ── */
const getTreeLabelCheckbox = (label: React.ReactNode) => () => {
  const [value, setValue] = React.useState(false);
  return (
    <TreeLabelInteractable>
      <Checkbox
        checked={value}
        onChange={(e) => setValue((e.target as HTMLInputElement).checked)}
      >
        {label}
      </Checkbox>
    </TreeLabelInteractable>
  );
};

const treeInteractableInitialData = [
  {
    id: 1,
    label: getTreeLabelCheckbox('Node 1'),
    isExpanded: true,
    children: [
      {
        id: 2,
        label: getTreeLabelCheckbox('Child 1.1'),
      },
      {
        id: 3,
        label: getTreeLabelCheckbox('Child 1.2'),
      },
    ],
  },
  {
    id: 4,
    label: getTreeLabelCheckbox('Node 2'),
    isExpanded: true,
    children: [
      {
        id: 5,
        label: getTreeLabelCheckbox('Child 2.1'),
      },
      {
        id: 6,
        label: getTreeLabelCheckbox('Child 2.2'),
        isExpanded: true,
        children: [
          {
            id: 7,
            label: getTreeLabelCheckbox('Grandchild 2.1'),
          },
          {
            id: 8,
            label: getTreeLabelCheckbox('Grandchild 2.2'),
          },
        ],
      },
    ],
  },
];

function TreeViewInteractableExample() {
  return <StatefulTreeView data={treeInteractableInitialData} />;
}

/* ── tree-view/uncontrolled.tsx ── */
const treeUncontrolledData = [
  {
    id: 1,
    label: 'Node 1',
    isExpanded: true,
    children: [
      {
        id: 2,
        label: 'Child 1',
        isExpanded: true,
        children: [
          {
            id: 3,
            label: 'Grandchild 1',
          },
        ],
      },
    ],
  },
  {
    id: 4,
    label: 'Node 2',
    isExpanded: true,
    children: [
      {
        id: 5,
        label: 'Child 2',
        isExpanded: true,
        children: [
          {
            id: 6,
            label: 'Grandchild 2',
          },
        ],
      },
    ],
  },
];

function TreeViewUncontrolledExample() {
  return <StatefulTreeView data={treeUncontrolledData} />;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * DRAG AND DROP LIST — ten examples
 *
 * Six are the examples the docs page renders; the last four are example files the page never
 * renders, appended rather than dropped.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const DND_ITEMS = ['Item 1', 'Item 2', 'Item 3', 'Item 4', 'Item 5', 'Item 6'];

/* ── dnd-list/stateless.tsx ── */
class DndStatelessExample extends React.Component<{}, { items: Array<React.ReactNode> }> {
  state = {
    items: DND_ITEMS,
  };
  render() {
    return (
      <DndList
        items={this.state.items}
        onChange={({ oldIndex, newIndex }) =>
          this.setState((prevState) => ({
            items: arrayMove(prevState.items, oldIndex, newIndex),
          }))
        }
      />
    );
  }
}

/* ── dnd-list/basic.tsx ── */
function DndBasicExample() {
  return (
    <StatefulList
      initialState={{
        items: DND_ITEMS,
      }}
      onChange={console.log}
    />
  );
}

/* ── dnd-list/removable.tsx ── */
function DndRemovableExample() {
  return (
    <StatefulList
      removable
      removableByMove
      initialState={{
        items: DND_ITEMS,
      }}
      overrides={{
        Root: {
          style: {
            maxWidth: '300px',
          },
        },
      }}
      onChange={console.log}
    />
  );
}

/* ── dnd-list/varyingHeights.tsx ── */
function DndVaryingHeightsExample() {
  return (
    <StatefulList
      initialState={{
        items: [
          'Lorem ipsum dolor sit amet, consectetur adipiscing elit.',
          'Donec ornare.',
          'Morbi malesuada id ante ac tincidunt. Phasellus at varius enim, fringilla pretium lorem. Integer placerat, est in aliquam tempus, ex urna hendrerit quam, eu sagittis nulla lorem eu magna.',
          'Morbi nibh nunc.',
          'Nunc consequat erat id ante mollis tincidunt in a nulla.',
        ],
      }}
      onChange={console.log}
    />
  );
}

/* ── dnd-list/customDragHandle.tsx ── */
const DndCustomDragHandle = () => {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        marginRight: '1em',
        width: '24px',
        display: 'flex',
        alignItems: 'center',
      })}
    >
      {/* Uber writes a light-grey literal on the handle; a raw hue is a value the theme cannot
          reach, so the handle takes the theme's own tertiary ink. */}
      <ArrowRight size={24} color={theme.colors.contentTertiary} />
    </div>
  );
};

function DndCustomDragHandleExample() {
  return (
    <StatefulList
      initialState={{
        items: DND_ITEMS,
      }}
      overrides={{
        DragHandle: DndCustomDragHandle,
      }}
      onChange={console.log}
    />
  );
}

/* ── dnd-list/overrideLabel.tsx ── */
function DndOverrideLabelExample() {
  return (
    <StatefulList
      initialState={{
        items: DND_ITEMS,
      }}
      overrides={{
        Label: {
          // Uber writes 'darkred' here; a raw hue is a literal the theme cannot reach, so the
          // dragged item takes the theme's accent and the override reads the same.
          style: ({ $theme, $isDragged }) => ({
            fontSize: $isDragged ? '20px' : 'inherit',
            color: $isDragged ? $theme.colors.accent : 'inherit',
          }),
        },
      }}
      onChange={console.log}
    />
  );
}

/* ── dnd-list/overrides_short.tsx ── */
function DndOverridesShortExample() {
  return (
    <StatefulList
      removable
      initialState={{
        items: DND_ITEMS.slice(0, 3),
      }}
    />
  );
}

/* ── dnd-list/overrides_state_props.tsx ── */
function DndOverridesStatePropsExample() {
  return (
    <StatefulList
      initialState={{
        items: DND_ITEMS.slice(0, 3),
      }}
      overrides={{
        Label: {
          style: ({ $theme, $isDragged }) => ({
            color: $isDragged ? $theme.colors.primary : $theme.colors.accent400,
          }),
        },
      }}
    />
  );
}

/* ── dnd-list/overrides_style.tsx ── */
function DndOverridesStyleExample() {
  return (
    <StatefulList
      removable
      initialState={{
        items: DND_ITEMS.slice(0, 3),
      }}
      overrides={{
        Label: {
          // Uber writes color:'red'; the theme's accent stands in for the literal.
          style: ({ $theme }) => ({
            color: $theme.colors.accent,
          }),
          props: {
            'data-testid': 'dnd-list-label',
          },
        },
      }}
    />
  );
}

/* ── dnd-list/overrides_whole_subcomponent.tsx ── */
class DndOverridesWholeSubcomponentExample extends React.Component<
  {},
  { items: Array<React.ReactNode> }
> {
  state = {
    items: ['Car', 'Truck', 'Bike', 'Skateboard'],
  };
  render() {
    return (
      <DndList
        items={this.state.items}
        onChange={({ oldIndex, newIndex }) =>
          this.setState((prevState) => ({
            items: arrayMove(prevState.items, oldIndex, newIndex),
          }))
        }
        overrides={{
          Label: {
            component: ({ $value }: any) => (
              <div style={{ flexGrow: 1 }}>
                {$value}{' '}
                <button
                  onClick={() =>
                    this.setState((prevState) => ({
                      items: prevState.items.concat([
                        `${typeof $value === 'string' ? $value : ''} clone`,
                      ]),
                    }))
                  }
                >
                  Clone
                </button>
              </div>
            ),
          },
        }}
      />
    );
  }
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PAGE
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function TablesSection() {
  return (
    <>
      <Section
        t="Table"
        n="Display larger amounts of information in a scannable UI; built on flex-box, so it runs in browsers without CSS grid."
      >
        <Grid>
          <Tile name="Table basic usage" span={12}>
            <FlexTableBasicExample />
          </Tile>
          <Tile
            name="Table cell examples"
            rule="The delta cell keeps Uber's negative/positive grounds; the theme collapses both onto ink."
            span={12}
          >
            <FlexTableCellsExample />
          </Tile>
          <Tile name="Table with pagination" span={12}>
            <FlexTablePaginationExample />
          </Tile>
          <Tile name="Table with sorting by a column" span={12}>
            <FlexTableSortableExample />
          </Tile>
          <Tile name="Table with fixed width column" span={12}>
            <FlexTableFixedWidthColumnExample />
          </Tile>
          <Tile name="Table with vertical scroll" span={12}>
            <FlexTableVerticalScrollExample />
          </Tile>
          <Tile name="Table with horizontal scroll" span={12}>
            <FlexTableHorizontalScrollExample />
          </Tile>
          <Tile
            name="Table with column filtering"
            rule="The filter popover's own words — Filter Column, Select All, Reset — are baked into the component body."
            span={12}
          >
            <FlexTableFilterExample />
          </Tile>
          <Tile
            name="Using react-vis"
            rule="An extra package the docs list for this example alone; the series takes the theme's ink."
            span={12}
          >
            <FlexTableGraphExample />
          </Tile>
          <Tile
            name="Table with virtualized table body"
            rule="react-virtualized supplies the windowing; Base supplies the row and cell."
            span={12}
          >
            <FlexTableVirtualExample />
          </Tile>
          <Tile name="Table with virtualized horizontal scroll" span={12}>
            <FlexTableVirtualHorizontalExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Table Semantic"
        n="Display tabular data in semantic HTML markup, for smaller sets that can all be rendered at once."
      >
        <Grid>
          <Tile name="Table basic usage" span={12}>
            <SemTableBasicExample />
          </Tile>
          <Tile name="Table with scrolling contents" span={12}>
            <SemTableScrollExample />
          </Tile>
          <Tile name="Table with empty message" span={12}>
            <SemTableEmptyMessageExample />
          </Tile>
          <Tile
            name="Table Builder"
            rule="TableBuilder renders each cell from a function of the row, instead of taking a data grid."
            span={12}
          >
            <SemTableBuilderExample />
          </Tile>
          <Tile name="Table Builder with sorting" span={12}>
            <SemTableSortableExample />
          </Tile>
          <Tile name="Table Builder with toggles" span={12}>
            <SemTableToggleableExample />
          </Tile>
          <Tile name="Table Builder with alternating rows" span={12}>
            <SemTableAlternatingExample />
          </Tile>
          <Tile
            name="Common cell examples"
            rule="Avatar, currency with a delta, tags and buttons — five cell shapes in one builder."
            span={12}
          >
            <SemTableCellsExample />
          </Tile>
          <Tile
            name="Table custom with merged cells"
            rule="Native rowSpan and colSpan, which only real table markup gives you."
            span={12}
          >
            <SemTableSpanExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Table Grid"
        n="Display larger amounts of information in a scannable UI, built on CSS grid so cells can span rows and columns."
      >
        <Grid>
          <Tile name="Basic usage" span={12}>
            <GridTableBasicExample />
          </Tile>
          <Tile
            name="Nested table"
            rule="A row expands into a full table of its own, spanning every column."
            span={12}
          >
            <GridTableNestedExample />
          </Tile>
          <Tile name="Cell spanning" span={12}>
            <GridTableCellSpanExample />
          </Tile>
          <Tile
            name="Table with sorting by a column"
            rule="The head-cell override takes the theme's accent where Uber's file writes a raw blue."
            span={12}
          >
            <GridTableSortableExample />
          </Tile>
          <Tile
            name="Accessible cell navigation"
            rule="Tab into the grid, then arrow between cells — the hook is Uber's, verbatim."
            span={12}
          >
            <GridTableCellNavigationExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Data Table"
        n="Display tabular data for analysis, with sorting, filtering and batch actions built into strict column types."
      >
        <Grid>
          <Tile
            name="Basic usage"
            rule="Two thousand rows across all six column kinds; the custom column carries a shade of Base's mono ramp."
            span={12}
          >
            <DataTableBasicExample />
          </Tile>
          <Tile
            name="Batch Actions"
            rule="Select rows to act on many at once; each row also carries its own actions."
            span={12}
          >
            <DataTableBatchActionExample />
          </Tile>
          <Tile name="Custom Line Height" span={12}>
            <DataTableLineClampExample />
          </Tile>
          <Tile
            name="Customized Column Sort"
            rule="A custom column supplying its own cell, filter panel, filter predicate and sort."
            span={12}
          >
            <DataTableCustomizedColumnSortExample />
          </Tile>
          <Tile name="Customized Empty State" span={12}>
            <DataTableCustomizedEmptyStateExample />
          </Tile>
          <Tile
            name="Imperatively access table data"
            rule="controlRef.getRows() hands back what is on screen, filtered and sorted — the ref is wired here, which Uber's file leaves unconnected."
            span={12}
          >
            <DataTableAccessTableDataExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Pagination"
        n="Divide content into separate pages, for when someone is searching rather than scanning and needs to keep a sense of position."
      >
        <Grid>
          <Tile name="Pagination Controlled example" span={6}>
            <PaginationControlledExample />
          </Tile>
          <Tile name="Pagination Uncontrolled example" span={6}>
            <PaginationUncontrolledExample />
          </Tile>
          <Tile
            name="Pagination with Custom Labels"
            rule="The labels prop replaces the component's own Prev, Next and of."
            span={6}
          >
            <PaginationLabelsExample />
          </Tile>
          <Tile name="Pagination with Overrides" span={6}>
            <PaginationOverridesExample />
          </Tile>
        </Grid>
      </Section>

      <Section t="Tree View" n="Display a hierarchical list of items.">
        <Grid>
          <Tile name="Basic usage" span={6}>
            <TreeViewBasicExample />
          </Tile>
          <Tile name="Adding custom labels" span={6}>
            <TreeViewCustomLabelExample />
          </Tile>
          <Tile
            name="Customizing icons and rendering all content for SEO"
            rule="renderAll keeps collapsed nodes in the markup, so a crawler still reads them."
            span={6}
          >
            <TreeViewOverridesExample />
          </Tile>
          <Tile name="Customizing labels based on depth" span={6}>
            <TreeViewLabelOverridesExample />
          </Tile>
          <Tile name="Expanding a single node at a time with indent guides" span={6}>
            <TreeViewSingleExpandedExample />
          </Tile>
          <Tile
            name="Using interactable elements in a tree node label"
            rule="TreeLabelInteractable keeps a click on the checkbox from toggling the node."
            span={6}
          >
            <TreeViewInteractableExample />
          </Tile>
          <Tile name="Stateful (uncontrolled) usage" span={6}>
            <TreeViewUncontrolledExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Drag and Drop List"
        n="Let someone change the order of a collection, by drag, touch or keyboard."
      >
        <Grid>
          <Tile
            name="Drag and Drop basic usage"
            rule="Space lifts an item, j/k or the arrows move it, Escape returns it."
            span={6}
          >
            <DndStatelessExample />
          </Tile>
          <Tile name="Drag and Drop stateful usage" span={6}>
            <DndBasicExample />
          </Tile>
          <Tile name="Drag and Drop with removable items" span={6}>
            <DndRemovableExample />
          </Tile>
          <Tile name="Drag and Drop with varying heights" span={6}>
            <DndVaryingHeightsExample />
          </Tile>
          <Tile name="Drag and Drop with custom drag handle" span={6}>
            <DndCustomDragHandleExample />
          </Tile>
          <Tile name="Drag and Drop with label override" span={6}>
            <DndOverrideLabelExample />
          </Tile>
          <Tile name="Overrides — short form" span={6}>
            <DndOverridesShortExample />
          </Tile>
          <Tile
            name="Overrides — style from state props"
            rule="The style function reads $isDragged off the component's own state."
            span={6}
          >
            <DndOverridesStatePropsExample />
          </Tile>
          <Tile name="Overrides — style and props together" span={6}>
            <DndOverridesStyleExample />
          </Tile>
          <Tile
            name="Overrides — whole subcomponent"
            rule="The Label is replaced outright, so the item carries its own control."
            span={6}
          >
            <DndOverridesWholeSubcomponentExample />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
