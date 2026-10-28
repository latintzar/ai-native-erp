/* NAVIGATION — Base Web's own examples, running under the Rocoto theme.
 *
 * Every demo below is Uber's demonstration code from baseweb's docs site, moved across whole,
 * and its copy is Uber's own, verbatim. The kit is grammar, not sentences: which control serves
 * which moment of the product is a decision for the situations catalogue, later and explicitly,
 * so no demo here pre-decides it.
 *
 * The edits are two, and only two:
 *   (a) docs-site-local imports (Layout, ExampleCard, next/image asset objects) become chrome
 *       or Vite asset URLs;
 *   (b) each example keeps its own hooks, so each is a separate function component, renamed so
 *       eleven of them can share one module.
 *
 * Colour: the theme re-inks. Where a Base example reaches for a THEME token that carries a hue
 * (icon/basic asks for `theme.colors.warning`), it is kept verbatim and the theme collapses it
 * onto ink — that is the point. Where an example hard-codes a colour OUTSIDE the theme
 * (`colors.red200` from baseui/tokens, `color: 'red'`, `dashed 2px blue`), the theme cannot
 * reach it, so the value is re-sourced from the theme. Marked ↯ at each site.
 *
 * Corners: every radius reads `theme.borders.radius100–500`, so the corner knob in the BRAND
 * block moves the phone frames and the divider card with it. The only literal hexes left are
 * the colour-name options the search select carries as DATA — the hex is the option's value,
 * shown as text and never painted — and each one says so with `// theme-gate-allow`.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';

import { useStyletron } from 'baseui';
import { styled } from 'baseui/styles';
import { Button } from 'baseui/button';
import { Layer } from 'baseui/layer';
import {
  Alert,
  ArrowDown,
  ArrowLeft,
  ArrowRight,
  ArrowUp,
  Calendar,
  Check,
  ChevronDown,
  ChevronLeft,
  ChevronRight,
  Delete,
  Overflow,
  Plus,
  Search,
  Show,
  Upload,
} from 'baseui/icon';
import * as Icons from 'baseui/icon/icon-exports';
import { AppNavBar, setItemActive, type NavItem as AppNavItem } from 'baseui/app-nav-bar';
import {
  HeaderNavigation,
  ALIGN,
  StyledNavigationItem as NavigationItem,
  StyledNavigationList as NavigationList,
} from 'baseui/header-navigation';
import { StatefulSelect as SearchSelect, TYPE as SELECT_TYPE } from 'baseui/select';
import { Navigation } from 'baseui/side-navigation';
import { MobileHeader, TYPE as MOBILE_HEADER_TYPE } from 'baseui/mobile-header';
import { BottomNavigation, NavItem as BottomNavItem } from 'baseui/bottom-navigation';
import { MessageCard } from 'baseui/message-card';
import { FileUploaderBasic } from 'baseui/file-uploader-basic';
import { Breadcrumbs } from 'baseui/breadcrumbs';
import { StyledLink as Link } from 'baseui/link';
import { Heading, HeadingLevel } from 'baseui/heading';
import {
  DisplayLarge,
  DisplayMedium,
  DisplaySmall,
  DisplayXSmall,
  HeadingXXLarge,
  HeadingXLarge,
  HeadingLarge,
  HeadingMedium,
  HeadingSmall,
  HeadingXSmall,
  LabelLarge,
  LabelMedium,
  LabelSmall,
  LabelXSmall,
  ParagraphLarge,
  ParagraphMedium,
  ParagraphSmall,
  ParagraphXSmall,
} from 'baseui/typography';
import { StyledDivider, SIZE as DIVIDER_SIZE } from 'baseui/divider';
import { Block } from 'baseui/block';

/* ── the docs-site example assets ────────────────────────────────────────────────────────────
 * The docs site is Next.js, where `import map from './images/x.jpg'` yields an object with a
 * `.src`. Under Vite the same file is addressed with `new URL(..., import.meta.url)`, which
 * needs no ambient module declaration and survives the build. These are Base's own example
 * images, used unchanged, alt text included.
 */
const mapUrl = new URL(
  '../../../bw-docs/examples/mobile-header/images/map-san-francisco.jpg',
  import.meta.url
).href;
const deliveryHeroItalianSvg = new URL(
  '../../../bw-docs/examples/bottom-navigation/images/deliveryHeroItalian.svg',
  import.meta.url
).href;
const deliveryLargeStrawberriesSvg = new URL(
  '../../../bw-docs/examples/bottom-navigation/images/deliveryLargeStrawberries.svg',
  import.meta.url
).href;
const earnerLargeRiderDriverSvg = new URL(
  '../../../bw-docs/examples/bottom-navigation/images/earnerLargeRiderDriver.svg',
  import.meta.url
).href;

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * app-nav-bar — examples/app-nav-bar/{basic,map-item-to-node,unique-identifier}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function AppNavBarBasic() {
  const [css] = useStyletron();

  const [mainItems, setMainItems] = React.useState<AppNavItem[]>([
    { icon: Upload, label: 'Primary A' },
    { icon: Upload, label: 'Primary B' },
    {
      icon: ChevronDown,
      label: 'Primary C',
      navExitIcon: Delete,
      children: [
        { icon: Upload, label: 'Secondary A' },
        { icon: Upload, label: 'Secondary B' },
        { icon: Upload, label: 'Secondary C' },
        { icon: Upload, label: 'Secondary D' },
      ],
    },
    {
      icon: ChevronDown,
      label: 'Primary D',
      navExitIcon: Delete,
      children: [
        {
          icon: ChevronDown,
          label: 'Secondary E',
          children: [
            { icon: Upload, label: 'Tertiary A' },
            { icon: Upload, label: 'Tertiary B' },
          ],
        },
        { icon: Upload, label: 'Secondary F' },
      ],
    },
  ]);
  const userItems = [
    { icon: Overflow, label: 'Account item1' },
    { icon: Overflow, label: 'Account item2' },
    { icon: Overflow, label: 'Account item3' },
    { icon: Overflow, label: 'Account item4' },
  ];

  const [isNavVisible, setIsNavVisible] = React.useState(false);

  function handleMainItemSelect(item: AppNavItem) {
    setMainItems((prev) => setItemActive(prev, item));
  }

  return (
    <React.Fragment>
      <Button onClick={() => setIsNavVisible((prev) => !prev)}>
        {isNavVisible ? 'Hide' : 'Show'} navigation bar
      </Button>
      {isNavVisible && (
        <Layer>
          <div
            className={css({
              boxSizing: 'border-box',
              width: '100vw',
              position: 'fixed',
              top: '0',
              left: '0',
            })}
          >
            <AppNavBar
              title="Uber Something"
              mainItems={mainItems}
              userItems={userItems}
              onMainItemSelect={handleMainItemSelect}
              onUserItemSelect={(item) => console.log('user', item)}
              username="Umka Marshmallow"
              usernameSubtitle="5.0"
              userImgUrl=""
            />
          </div>
        </Layer>
      )}
    </React.Fragment>
  );
}

function AppNavBarMapItemToNode() {
  const [css, theme] = useStyletron();
  const palette = theme.colors as unknown as Record<string, string>;

  const [mainItems, setMainItems] = React.useState<AppNavItem[]>([
    { label: 'main one', info: { color: 'accent' } },
    { label: 'main two', info: { color: 'contentPrimary' } },
  ]);

  const userItems = [
    { label: 'user one', info: { color: 'contentPrimary' } },
    { label: 'user two', info: { color: 'accent' } },
  ];

  function handleMainItemSelect(item: AppNavItem) {
    setMainItems((prev) => setItemActive(prev, item));
  }

  return (
    <AppNavBar
      title="Title"
      mainItems={mainItems}
      userItems={userItems}
      mapItemToNode={(item) => (
        <div
          className={css({
            // ↯ Uber's original reads `dashed 2px ${item.info.color}` off literal 'blue'/'red',
            // and falls back to 'green'. The payload keeps driving the border; the names it
            // carries are theme tokens now, so the Rocoto theme reaches this like everything
            // else on the page.
            border: `dashed 2px ${
              item.info ? palette[item.info.color] : theme.colors.contentPrimary
            }`,
          })}
        >
          {item.info ? `color: ${item.info.color}` : item.label}
        </div>
      )}
      onMainItemSelect={handleMainItemSelect}
      username="Umka Marshmallow"
      usernameSubtitle="5.0"
      userImgUrl=""
    />
  );
}

function AppNavBarUniqueIdentifier() {
  const [mainItems, setMainItems] = React.useState<AppNavItem[]>([
    { label: 'label', info: { id: 1 } },
    { label: 'label', info: { id: 2 } },
    { label: 'label', info: { id: 3 } },
    { label: 'label', info: { id: 4 } },
  ]);

  function getUniqueIdentifier(item: AppNavItem) {
    if (item.info) {
      return item.info.id;
    }
    return item.label;
  }

  function handleMainItemSelect(item: AppNavItem) {
    setMainItems((prev) => setItemActive(prev, item, getUniqueIdentifier));
  }

  return (
    <AppNavBar
      title="Title"
      mainItems={mainItems}
      onMainItemSelect={handleMainItemSelect}
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * header-navigation — examples/header-navigation/{basic,with-search}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function HeaderNavigationBasic() {
  return (
    <HeaderNavigation>
      <NavigationList $align={ALIGN.left}>
        <NavigationItem>Uber</NavigationItem>
      </NavigationList>
      <NavigationList $align={ALIGN.center} />
      <NavigationList $align={ALIGN.right}>
        <NavigationItem>
          <Link href="#basic-link1">Tab Link One</Link>
        </NavigationItem>
        <NavigationItem>
          <Link href="#basic-link2">Tab Link Two</Link>
        </NavigationItem>
      </NavigationList>
      <NavigationList $align={ALIGN.right}>
        <NavigationItem>
          <Button>Get started</Button>
        </NavigationItem>
      </NavigationList>
    </HeaderNavigation>
  );
}

/* Uber's stock search options. Each hex is the option's VALUE (`valueKey: 'color'`) — it is
 * carried as text and never painted, so it is data the select holds, not brand. */
const options = {
  options: [
    { id: 'AliceBlue', color: '#F0F8FF' }, // theme-gate-allow: select option data, never painted
    { id: 'AntiqueWhite', color: '#FAEBD7' }, // theme-gate-allow: select option data, never painted
    { id: 'Aqua', color: '#00FFFF' }, // theme-gate-allow: select option data, never painted
    { id: 'Aquamarine', color: '#7FFFD4' }, // theme-gate-allow: select option data, never painted
    { id: 'Azure', color: '#F0FFFF' }, // theme-gate-allow: select option data, never painted
    { id: 'Beige', color: '#F5F5DC' }, // theme-gate-allow: select option data, never painted
    { id: 'Bisque', color: '#FFE4C4' }, // theme-gate-allow: select option data, never painted
    { id: 'Black', color: '#000000' }, // theme-gate-allow: select option data, never painted
  ],
  labelKey: 'id',
  valueKey: 'color',
  placeholder: 'Search colors',
  maxDropdownHeight: '300px',
};

function HeaderNavigationWithSearch() {
  return (
    <HeaderNavigation>
      <NavigationList $align={ALIGN.left}>
        <NavigationItem>Uber</NavigationItem>
      </NavigationList>
      <NavigationList $align={ALIGN.center} />
      <NavigationList $align={ALIGN.right}>
        <NavigationItem>
          <Link href="#search-link1">Tab Link One</Link>
        </NavigationItem>
      </NavigationList>
      <NavigationList $align={ALIGN.right}>
        <NavigationItem style={{ width: '200px' }}>
          <SearchSelect
            {...options}
            type={SELECT_TYPE.search}
            getOptionLabel={(props: any) =>
              props.option && props.option.id ? props.option.id : null
            }
            onChange={() => {}}
          />
        </NavigationItem>
      </NavigationList>
    </HeaderNavigation>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * side-navigation — examples/side-navigation/{basic,nav-overrides}.tsx
 * (no docs page exists for this component; the note is taken from its own README)
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

const nav = [
  {
    title: 'Colors',
    itemId: '#level1.1',
    subNav: [
      {
        title: 'Primary',
        itemId: '#level1.1.1',
      },
      {
        title: 'Shades',
        itemId: '#level1.1.2',
        subNav: [
          {
            title: 'Dark',
            itemId: '#level1.1.2.1',
          },
          {
            title: 'Light',
            itemId: '#level1.1.2.2',
          },
        ],
      },
    ],
  },
  {
    title: 'Sizing',
    itemId: '#level1.2',
  },
  {
    title: 'Typography',
    itemId: '#level1.3',
  },
];

function SideNavigationBasic() {
  const [location, setLocation] = React.useState('#level1.1.1');
  return (
    <Navigation
      items={nav}
      activeItemId={location}
      onChange={({ item }) => setLocation(item.itemId as string)}
    />
  );
}

/* Both side-navigation examples share one page here, where Uber's docs give each its own frame,
 * so the second example's itemIds carry an `ov-` prefix. The titles are Uber's. */
const navOverrides = [
  {
    title: 'Colors',
    itemId: '#ov-level1.1',
    subNav: [
      {
        title: 'Primary',
        itemId: '#ov-level1.1.1',
      },
      {
        title: 'Shades',
        itemId: '#ov-level1.1.2',
        subNav: [
          {
            title: 'Dark',
            itemId: '#ov-level1.1.2.1',
          },
          {
            title: 'Light',
            itemId: '#ov-level1.1.2.2',
          },
        ],
      },
    ],
  },
  {
    title: 'Sizing',
    itemId: '#ov-level1.2',
  },
  {
    title: 'Typography',
    itemId: '#ov-level1.3',
  },
];

function SideNavigationOverrides() {
  const [location, setLocation] = React.useState('#ov-level1.1.1');
  return (
    <Navigation
      items={navOverrides}
      activeItemId={location}
      onChange={({ item }) => setLocation(item.itemId as string)}
      overrides={{
        NavItem: {
          style: ({ $active, $theme }: { $active: boolean; $theme: any }) => {
            if (!$active)
              return {
                ':hover': {
                  color: $theme.colors.positive400,
                },
              };
            return {
              backgroundColor: $theme.colors.positive400,
              // ↯ Uber pairs the green fill with mono900 text. Under this theme positive400
              // collapses onto ink, and a near-black grey on ink is unreadable — so the
              // foreground moves to Base's own on-dark token, which mono900 was standing in for.
              borderLeftColor: $theme.colors.contentInversePrimary,
              color: $theme.colors.contentInversePrimary,
              ':hover': {
                color: $theme.colors.contentInverseSecondary,
              },
            };
          },
        },
      }}
    />
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * mobile-header — examples/mobile-header/{floating,text-content}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function MobileHeaderFloating() {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        width: '375px',
        height: '667px',
        border: `1px solid ${theme.colors.borderOpaque}`, // ↯ was Uber's own hairline grey
        borderRadius: theme.borders.radius400,
        overflow: 'auto',
        position: 'relative',
      })}
    >
      <div
        className={css({
          width: '100%',
          position: 'absolute',
          pointerEvents: 'none',
        })}
      >
        <MobileHeader
          type={MOBILE_HEADER_TYPE.floating}
          navButton={{
            renderIcon: ({ size }) => <ArrowLeft size={size} />,
            onClick: () => console.log('Nav Button Click'),
            label: 'Go back',
          }}
          actionButtons={[
            {
              renderIcon: ({ size }) => <Check size={size} />,
              onClick: () => console.log('Check Button Click'),
              label: 'Confirm entries',
            },
            {
              renderIcon: ({ size }) => <Plus size={size} />,
              onClick: () => console.log('Plus Button Click'),
              label: 'Add a new entry',
            },
          ]}
        />
      </div>
      <div
        style={{ height: '100%', width: '100%', overflowY: 'auto' }}
        tabIndex={0}
      >
        <img
          style={{
            width: '100%',
            height: 'auto',
          }}
          src={mapUrl}
          alt="SF map"
        />
      </div>
    </div>
  );
}

function MobileHeaderTextContent() {
  const [expanded, setExpanded] = React.useState(true);
  const [css, theme] = useStyletron();
  return (
    <div>
      <div style={{ marginBottom: '20px' }}>
        <Button onClick={() => setExpanded(!expanded)}>
          {expanded ? 'Collapse' : 'Expand'}
        </Button>
      </div>

      <div
        className={css({
          width: '375px',
          height: '667px',
          border: `1px solid ${theme.colors.borderOpaque}`, // ↯ was Uber's own hairline grey
          borderRadius: theme.borders.radius400,
          overflow: 'auto',
        })}
      >
        <MobileHeader
          title="Header title"
          expanded={expanded}
          navButton={{
            onClick: () => console.log('Nav Button Click'),
            label: 'Back',
          }}
          actionButtons={[
            {
              onClick: () => console.log('Check Button Click'),
              label: 'Action',
            },
          ]}
        />
        <div
          style={{
            padding: '12px',
            height: '100%',
            overflow: 'auto',
          }}
          tabIndex={0}
        >
          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>

          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>

          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>

          <p>
            Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do
            eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim
            ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut
            aliquip ex ea commodo consequat. Duis aute irure dolor in
            reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla
            pariatur. Excepteur sint occaecat cupidatat non proident, sunt in
            culpa qui officia deserunt mollit anim id est laborum.
          </p>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * bottom-navigation — examples/bottom-navigation/overflow.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

export const TextContent = ({
  numParagraphs,
  children,
}: {
  numParagraphs: number;
  children?: React.ReactNode;
}) => {
  const Paragraph = () => (
    <p>
      Nemo enim ipsam voluptatem quia voluptas sit aspernatur aut odit aut
      fugit, sed quia consequuntur magni dolores eos qui ratione voluptatem
      sequi nesciunt. Neque porro quisquam est, qui dolorem ipsum quia dolor sit
      amet, consectetur, adipisci velit, sed quia non numquam eius modi tempora
      incidunt ut labore et dolore magnam aliquam quaerat voluptatem.
    </p>
  );

  const paragraphs =
    numParagraphs > 0 ? Array(numParagraphs).fill(Paragraph) : [];

  return (
    <div style={{ padding: '10px' }}>
      {children}
      {paragraphs.map((Paragraph, idx) => (
        <Paragraph key={idx} />
      ))}
    </div>
  );
};

const StyledIphone6 = styled('div', ({ $theme }) => ({
  width: '375px',
  height: '667px',
  border: `1px solid ${$theme.colors.borderOpaque}`, // ↯ was Uber's own hairline grey
  borderRadius: $theme.borders.radius400,
  position: 'relative',
  overflow: 'hidden',
}));

function BottomNavigationOverflow() {
  const [, theme] = useStyletron();
  const [activeKey, setActiveKey] = React.useState<number>(0);

  return (
    <StyledIphone6>
      <BottomNavigation
        activeKey={activeKey}
        onChange={({ activeKey }) => setActiveKey(activeKey)}
      >
        <BottomNavItem title="Search" icon={Search}>
          <TextContent numParagraphs={8}>
            <h1>Search content</h1>
          </TextContent>
        </BottomNavItem>

        <BottomNavItem title="Food" icon={Show}>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '20px',
            }}
          >
            <MessageCard
              heading="Heading"
              paragraph="ipsum lorem dopem topo logic hippos bananas and the rest"
              buttonLabel="Save now"
              image={{
                src: deliveryHeroItalianSvg,
                ariaLabel:
                  'Illustration of an Italian meal with pizza and pasta on a picnic table',
              }}
              onClick={() => console.log('Saved')}
              // ↯ Uber passes `colors.red200` / `colors.blue300` straight from baseui/tokens,
              // which sits outside the theme and so keeps its hue through the re-ink. The prop
              // is the demonstration; the value now comes from the theme.
              backgroundColor={theme.colors.mono200}
            />
            <MessageCard
              paragraph="ipsum lorem dopem topo logic hippos bananas and the rest"
              buttonLabel="Save now"
              image={{
                src: deliveryLargeStrawberriesSvg,
                ariaLabel: 'Illustration of strawberries',
              }}
              onClick={() => console.log('Saved')}
            />
            <MessageCard
              heading="Heading"
              paragraph="ipsum lorem dopem topo logic hippos bananas and the rest"
              image={{
                src: earnerLargeRiderDriverSvg,
                ariaLabel: 'A car with a driver and a passenger both wearing masks',
              }}
              onClick={() => console.log('Saved')}
              backgroundColor={theme.colors.mono300}
            />
          </div>
        </BottomNavItem>

        <BottomNavItem title="Schedule" icon={Calendar}>
          <TextContent numParagraphs={3}>
            <h1>Schedule content</h1>
          </TextContent>
        </BottomNavItem>

        <BottomNavItem title="Attention" icon={Alert}>
          <TextContent numParagraphs={2}>
            <h1>Attention content</h1>
          </TextContent>
        </BottomNavItem>

        <BottomNavItem title="Transit" icon={ChevronRight}>
          <TextContent numParagraphs={3}>
            <h1>Transit content</h1>
          </TextContent>
        </BottomNavItem>

        <BottomNavItem title="Upload" icon={Upload}>
          <TextContent numParagraphs={0}>
            <h1>File Upload</h1>
            <FileUploaderBasic errorMessage={''} />
          </TextContent>
        </BottomNavItem>
      </BottomNavigation>
    </StyledIphone6>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * breadcrumbs — examples/breadcrumbs/{basic,pseudo}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function BreadcrumbsBasic() {
  return (
    <Breadcrumbs>
      <Link href="#basic-parent">Parent Page</Link>
      <Link href="#basic-subparent">Sub-Parent Page</Link>
      <span>Current Page</span>
    </Breadcrumbs>
  );
}

function BreadcrumbsPseudo() {
  return (
    <Breadcrumbs
      overrides={{
        ListItem: {
          style: ({ $itemIndex, $theme }: { $itemIndex: number; $theme: any }) => {
            if ($itemIndex === 0) return {};
            return {
              ':before': {
                content: "'>'",
                color: $theme.colors.mono700,
                marginLeft: $theme.sizing.scale400,
                marginRight: $theme.sizing.scale400,
                ...$theme.typography.font350,
              },
            };
          },
        },
        Separator: {
          component: () => null,
        },
      }}
    >
      <Link href="#pseudo-parent">Parent Page</Link>
      <Link href="#pseudo-subparent">Sub-Parent Page</Link>
      <span>Current Page</span>
    </Breadcrumbs>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * link — the docs page carries a Yard playground and prose, and ships no example files.
 * These three tiles are built from baseui/src/link/styled-components.ts: the default, the
 * `animateUnderline` call-to-action the docs page names, and the `fontSize: inherit` behaviour
 * the component's own stylesheet declares. The strings are Uber's own — the playground's
 * default children and href (bw-docs/components/yard/config/link.ts) and the lorem the heading
 * example ships.
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function LinkDefault() {
  return <Link href="https://baseweb.design">Link to Base Web</Link>;
}

function LinkAnimateUnderline() {
  return (
    <Link animateUnderline href="https://baseweb.design">
      Link to Base Web
    </Link>
  );
}

function LinkInRunningText() {
  return (
    <ParagraphSmall>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum
      fermentum velit ante, ac fringilla nulla pulvinar in.{' '}
      <Link href="https://baseweb.design">Link to Base Web</Link>. Aenean ut
      nisi mattis, lobortis purus vel, aliquet ante. In vel viverra lectus.
    </ParagraphSmall>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * heading — examples/heading/{basic,decouple-styles}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

const HeadingBasic = () => (
  <HeadingLevel>
    <Heading>Base Web [L1]</Heading>
    <ParagraphSmall>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum
      fermentum velit ante, ac fringilla nulla pulvinar in. Aenean ut nisi
      mattis, lobortis purus vel, aliquet ante. In vel viverra lectus. Vivamus a
      diam faucibus, rutrum quam a, varius felis. Sed pellentesque sodales
      libero commodo vestibulum. Phasellus convallis gravida tempor. Sed ut
      bibendum nisl.
    </ParagraphSmall>
    <HeadingLevel>
      <Heading>Introduction [L2]</Heading>
      <ParagraphSmall>
        Vivamus vehicula justo suscipit, vestibulum nibh eu, faucibus nisi.
        Aenean molestie sapien nibh, sed sagittis turpis iaculis id. Nam mollis
        pulvinar ex eget gravida. Pellentesque fringilla odio a consequat
        condimentum. Curabitur ut auctor mi. Nunc blandit, tellus quis fringilla
        sollicitudin, risus libero scelerisque lorem, ut sagittis risus ipsum in
        nisl.
      </ParagraphSmall>
      <HeadingLevel>
        <Heading>Quotes [L3]</Heading>
        <ParagraphSmall>
          Cras posuere placerat sem sit amet dignissim. Sed pellentesque
          sagittis sapien at maximus. Ut at gravida lectus. Suspendisse lectus
          libero, eleifend vestibulum imperdiet ut, rhoncus eu augue.
          Pellentesque in vulputate lacus, quis molestie lorem. Aenean sit amet
          blandit nisi. Nullam molestie mi vel quam vehicula, in cursus eros
          tempus. Sed placerat turpis vestibulum quam suscipit, eget volutpat
          massa aliquet.
        </ParagraphSmall>
        <HeadingLevel>
          <Heading>Subtitle [L4]</Heading>
          <ParagraphSmall>
            Proin et posuere lectus. Curabitur condimentum, mauris in viverra
            euismod, diam elit porttitor quam, ac dictum diam diam eu mauris.
            Maecenas viverra, turpis sed commodo hendrerit, quam ipsum finibus
            mauris, et scelerisque sapien tellus mollis leo. Praesent posuere,
            felis at sagittis hendrerit, est massa tincidunt risus, eget tempus
            dolor ligula et odio. Praesent luctus lacus quis tristique semper.
            Etiam semper lacus non auctor fringilla.
          </ParagraphSmall>
          <HeadingLevel>
            <Heading>Subtitle [L5]</Heading>
            <ParagraphSmall>
              Vivamus vehicula justo suscipit, vestibulum nibh eu, faucibus
              nisi. Aenean molestie sapien nibh, sed sagittis turpis iaculis id.
              Nam mollis pulvinar ex eget gravida. Pellentesque fringilla odio a
              consequat condimentum. Curabitur ut auctor mi. Nunc blandit,
              tellus quis fringilla sollicitudin, risus libero scelerisque
              lorem, ut sagittis risus ipsum in nisl.
            </ParagraphSmall>
            <HeadingLevel>
              <Heading>Subtitle [L6]</Heading>
              <ParagraphSmall>
                Proin et posuere lectus. Curabitur condimentum, mauris in
                viverra euismod, diam elit porttitor quam, ac dictum diam diam
                eu mauris. Maecenas viverra, turpis sed commodo hendrerit, quam
                ipsum finibus mauris, et scelerisque sapien tellus mollis leo.
                Praesent posuere, felis at sagittis hendrerit, est massa
                tincidunt risus, eget tempus dolor ligula et odio. Praesent
                luctus lacus quis tristique semper. Etiam semper lacus non
                auctor fringilla.
              </ParagraphSmall>
            </HeadingLevel>
          </HeadingLevel>
        </HeadingLevel>
      </HeadingLevel>
      <Heading>Motivation [L2]</Heading>
      <ParagraphSmall>
        Vivamus vehicula justo suscipit, vestibulum nibh eu, faucibus nisi.
        Aenean molestie sapien nibh, sed sagittis turpis iaculis id. Nam mollis
        pulvinar ex eget gravida. Pellentesque fringilla odio a consequat
        condimentum. Curabitur ut auctor mi. Nunc blandit, tellus quis fringilla
        sollicitudin, risus libero scelerisque lorem, ut sagittis risus ipsum in
        nisl.
      </ParagraphSmall>
    </HeadingLevel>
  </HeadingLevel>
);

const HeadingDecoupleStyles = () => (
  <HeadingLevel>
    <Heading styleLevel={4}>Base Web [L1 styled as L4]</Heading>
    <ParagraphSmall>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit. Vestibulum
      fermentum velit ante, ac fringilla nulla pulvinar in. Aenean ut nisi
      mattis, lobortis purus vel, aliquet ante. In vel viverra lectus. Vivamus a
      diam faucibus, rutrum quam a, varius felis. Sed pellentesque sodales
      libero commodo vestibulum. Phasellus convallis gravida tempor. Sed ut
      bibendum nisl.
    </ParagraphSmall>
    <HeadingLevel>
      <Heading styleLevel={5}>Introduction [L2 styled as L5]</Heading>
      <ParagraphSmall>
        Vivamus vehicula justo suscipit, vestibulum nibh eu, faucibus nisi.
        Aenean molestie sapien nibh, sed sagittis turpis iaculis id. Nam mollis
        pulvinar ex eget gravida. Pellentesque fringilla odio a consequat
        condimentum. Curabitur ut auctor mi. Nunc blandit, tellus quis fringilla
        sollicitudin, risus libero scelerisque lorem, ut sagittis risus ipsum in
        nisl.
      </ParagraphSmall>
      <HeadingLevel>
        <Heading styleLevel={6}>Quotes [L3 styled as L6]</Heading>
        <ParagraphSmall>
          Cras posuere placerat sem sit amet dignissim. Sed pellentesque
          sagittis sapien at maximus. Ut at gravida lectus. Suspendisse lectus
          libero, eleifend vestibulum imperdiet ut, rhoncus eu augue.
          Pellentesque in vulputate lacus, quis molestie lorem. Aenean sit amet
          blandit nisi. Nullam molestie mi vel quam vehicula, in cursus eros
          tempus. Sed placerat turpis vestibulum quam suscipit, eget volutpat
          massa aliquet.
        </ParagraphSmall>
      </HeadingLevel>
      <Heading styleLevel={5}>Motivation [L2 styled as L5]</Heading>
      <ParagraphSmall>
        Proin et posuere lectus. Curabitur condimentum, mauris in viverra
        euismod, diam elit porttitor quam, ac dictum diam diam eu mauris.
        Maecenas viverra, turpis sed commodo hendrerit, quam ipsum finibus
        mauris, et scelerisque sapien tellus mollis leo. Praesent posuere, felis
        at sagittis hendrerit, est massa tincidunt risus, eget tempus dolor
        ligula et odio. Praesent luctus lacus quis tristique semper. Etiam
        semper lacus non auctor fringilla.
      </ParagraphSmall>
    </HeadingLevel>
  </HeadingLevel>
);

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * typography — examples/typography/{display,heading,text}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

const textString = 'We ignite opportunity by setting the world in motion.';
const bodyString =
  'Good things happen when people can move, whether across town or towards their dreams. Opportunities appear, open up, become reality. What started as a way to tap a button to get a ride has led to billions of moments of human connection as people around the world go all kinds of places in all kinds of ways with the help of our technology.';

function TypographyDisplay() {
  return (
    <React.Fragment>
      <DisplayLarge marginBottom="scale500">{textString}</DisplayLarge>
      <DisplayMedium marginBottom="scale500">{textString}</DisplayMedium>
      <DisplaySmall marginBottom="scale500">{textString}</DisplaySmall>
      <DisplayXSmall>{textString}</DisplayXSmall>
    </React.Fragment>
  );
}

function TypographyHeading() {
  return (
    <React.Fragment>
      <HeadingXXLarge>{textString}</HeadingXXLarge>
      <HeadingXLarge>{textString}</HeadingXLarge>
      <HeadingLarge>{textString}</HeadingLarge>
      <HeadingMedium>{textString}</HeadingMedium>
      <HeadingSmall>{textString}</HeadingSmall>
      <HeadingXSmall>{textString}</HeadingXSmall>
    </React.Fragment>
  );
}

function TypographyText() {
  return (
    <React.Fragment>
      <LabelLarge>{textString}</LabelLarge>
      <ParagraphLarge>{bodyString}</ParagraphLarge>
      <LabelMedium>{textString}</LabelMedium>
      <ParagraphMedium>{bodyString}</ParagraphMedium>
      <LabelSmall>{textString}</LabelSmall>
      <ParagraphSmall>{bodyString}</ParagraphSmall>
      <LabelXSmall>{textString}</LabelXSmall>
      <ParagraphXSmall>{bodyString}</ParagraphXSmall>
    </React.Fragment>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * divider — examples/divider/basic.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function DividerBasic() {
  const [, theme] = useStyletron();
  return (
    <div
      style={{
        width: '400px',
        border: `1px solid ${theme.colors.borderOpaque}`, // ↯ was Uber's own hairline grey
        borderRadius: theme.borders.radius300,
      }}
    >
      <div
        style={{
          height: '50px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        Cell Divider
      </div>

      <StyledDivider $size={DIVIDER_SIZE.cell} />

      <div
        style={{
          height: '80px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        Section Divider
      </div>

      <StyledDivider $size={DIVIDER_SIZE.section} />

      <div
        style={{
          height: '160px',
          display: 'flex',
          alignItems: 'flex-end',
          justifyContent: 'center',
        }}
      >
        Module Divider
      </div>

      <StyledDivider $size={DIVIDER_SIZE.module} />

      <div style={{ height: '160px' }}></div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * block — examples/block/{basic,responsive,override}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function BlockBasic() {
  return (
    <React.Fragment>
      <Block>first element</Block>
      <Block paddingTop="100px">padding top applied to this element</Block>
    </React.Fragment>
  );
}

function BlockResponsive() {
  return (
    <Block
      height={['20px', '40px', '80px', '160px']}
      backgroundColor="primary200"
    />
  );
}

function BlockOverride() {
  return (
    <Block
      as="h2"
      overrides={{
        Block: {
          // ↯ Uber writes `style: {color: 'red'}`. A literal sits outside the theme, so it keeps
          // its hue through the re-ink; the override is the demonstration, and the value it
          // carries is now a theme token.
          style: ({ $theme }: { $theme: any }) => ({ color: $theme.colors.accent }),
        },
      }}
    >
      These styles are provided by styletron
    </Block>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * icon — examples/icon/{basic,list,button}.tsx
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

function IconBasic() {
  const [css, theme] = useStyletron();
  return (
    // theme.colors.warning is kept exactly as Uber wrote it. The Rocoto theme collapses warning
    // onto ink, and that collapse IS the demonstration: colour is not a status system here.
    <div className={css({ color: theme.colors.warning })}>
      <ArrowUp size={36} />
      <ArrowUp size={36} />
      <ArrowDown size={36} />
      <ArrowDown size={36} />
      <ArrowLeft size={36} />
      <ArrowRight size={36} />
      <ArrowLeft size={36} />
      <ArrowRight size={36} />
    </div>
  );
}

function makeImportStatement(key: string) {
  const path = key
    .split(/(?=[A-Z])/)
    .map((word) => word.toLowerCase())
    .join('-');

  return `import ${key} from 'baseui/icon/${path}'`;
}

function IconListRow(props: any) {
  const [css, theme] = useStyletron();
  const Icon = props.icon;
  return (
    <div
      className={css({
        alignItems: 'center',
        color: theme.colors.contentPrimary,
        display: 'flex',
        paddingBottom: theme.sizing.scale500,
      })}
    >
      <Icon size={24} />
      <div
        className={css({
          color: theme.colors.contentSecondary,
          marginLeft: theme.sizing.scale200,
        })}
      >
        {props.title}
      </div>
      <div
        className={css({
          color: theme.colors.contentSecondary,
          marginLeft: theme.sizing.scale200,
        })}
      >
        {makeImportStatement(props.title)}
      </div>
    </div>
  );
}

function IconList() {
  return (
    <div>
      {/* the CJS interop namespace carries `default`/`__esModule` — rendering those as
          components is React error 130, so only real exports pass */}
      {Object.entries(Icons)
        .filter(([k]) => k !== 'default' && k !== '__esModule')
        .map(([title, Icon]: [string, any]) => (
        <IconListRow key={title} title={title} icon={Icon} />
      ))}
    </div>
  );
}

function IconButton() {
  const [css, theme] = useStyletron();
  return (
    <div>
      <div className={css({ paddingBottom: theme.sizing.scale300 })}>
        <Button startEnhancer={() => <ChevronLeft title="" />}>
          Start Enhancer
        </Button>
      </div>

      <div className={css({ paddingBottom: theme.sizing.scale300 })}>
        <Button endEnhancer={() => <ChevronRight title="" />}>
          End Enhancer
        </Button>
      </div>

      <div>
        <Button>
          <Upload />
        </Button>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════════════════════════════════════
 * THE SECTION
 * ════════════════════════════════════════════════════════════════════════════════════════════ */

export default function NavigationSection() {
  return (
    <>
      <Section
        t="Application navigation bar"
        n="Use it to give every section of an application one shared bar, so people stay oriented as they move."
      >
        <Grid>
          <Tile
            span={12}
            name="Basic example"
            rule="Desktop and mobile in one component: the bar collapses to a drawer on its own, carries two levels of sub-navigation, and holds the account menu on the right."
          >
            <AppNavBarBasic />
          </Tile>
          <Tile
            span={12}
            name="Custom menu item"
            rule="mapItemToNode renders something other than text in a menu item. Each item's own `info` payload drives what comes out."
          >
            <AppNavBarMapItemToNode />
          </Tile>
          <Tile
            span={12}
            name="Non unique labels"
            rule="setItemActive matches on the label by default. Four items sharing one label need an identifier of their own, passed as a third argument."
          >
            <AppNavBarUniqueIdentifier />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Header navigation"
        n="A top bar that holds the product name on one side and its links and actions on the other."
      >
        <Grid>
          <Tile
            span={12}
            name="Header navigation basic usage"
            rule="Three alignment lists — left, center, right — laid out by the bar itself. A second right-aligned list separates the action from the links."
          >
            <HeaderNavigationBasic />
          </Tile>
          <Tile
            span={12}
            name="Header navigation with search"
            rule="A full stateful select, in search mode, dropped into a navigation item. It brings its own popover, filtering and keyboard handling."
          >
            <HeaderNavigationWithSearch />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Side navigation"
        n="A list of links down the side of a page, able to carry several levels at once."
      >
        <Grid>
          <Tile
            span={6}
            name="Basic"
            rule="Three levels deep. The active item drives its own expansion, and the caller keeps the location."
          >
            <SideNavigationBasic />
          </Tile>
          <Tile
            span={6}
            name="Nav overrides"
            rule="The NavItem override receives $active, so rest, hover and selected are styled from one function."
          >
            <SideNavigationOverrides />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Mobile header"
        n="It sits below the status bar and above the screen's content, so people can move through a flow and read what the screen is about."
      >
        <Grid>
          <Tile
            span={6}
            name="Floating header"
            rule="The floating type has no title and no expanded state: it floats over a map or a photo, and the space between the buttons stays touchable."
          >
            <MobileHeaderFloating />
          </Tile>
          <Tile
            span={6}
            name="Buttons with text content"
            rule="The fixed type carries a title, a navigation button and up to two actions. Buttons take text as readily as icons, and the header collapses as the content scrolls."
          >
            <MobileHeaderTextContent />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Bottom navigation"
        n="Use it when people move between three to five top-level sections of an app; anything past the fifth is grouped into an overflow tab."
      >
        <Grid>
          <Tile
            span={6}
            name="Bottom Navigation Overflow example"
            rule="Six sections supplied, so the sixth and beyond fold into the overflow tab automatically. Each panel keeps its own scroll position as you move between them."
          >
            <BottomNavigationOverflow />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Breadcrumbs"
        n="A secondary navigation that shows where in the application the person currently stands."
      >
        <Grid>
          <Tile
            span={6}
            name="Breadcrumbs basic usage"
            rule="Children become the trail; the last one is the current page and stays plain text. The separator is supplied by the component."
          >
            <BreadcrumbsBasic />
          </Tile>
          <Tile
            span={6}
            name="Breadcrumbs with pseudo separators"
            rule="The separator moves into a :before pseudo-element and the real one is removed. Base recommends this shape where SEO and assistive technology matter."
          >
            <BreadcrumbsPseudo />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Link"
        n="Use it for text that takes the person somewhere else; animateUnderline marks the one that opens a flow."
      >
        <Grid>
          <Tile
            span={4}
            name="StyledLink"
            rule="Rest, hover, visited, active and a focus ring that appears for the keyboard only — all five states ship with the component."
          >
            <LinkDefault />
          </Tile>
          <Tile
            span={4}
            name="animateUnderline"
            rule="The underline is a background-size transition on Base's own quintic curve, so it wipes in from the start of the text. Reserved for a call to action."
          >
            <LinkAnimateUnderline />
          </Tile>
          <Tile
            span={4}
            name="Inside running text"
            rule="Font size and line height are declared as inherit, so a link takes the type of whatever text block it sits in."
          >
            <LinkInRunningText />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Heading"
        n="Headings carry the document outline that screen readers depend on; the component works the level out from where it sits."
      >
        <Grid>
          <Tile
            span={6}
            name="Heading basic usage"
            rule="Six levels, and not one of them written as h1..h6. HeadingLevel nests, and the component renders the right element and the matching style."
          >
            <HeadingBasic />
          </Tile>
          <Tile
            span={6}
            name="Decouple and fix heading styles"
            rule="styleLevel fixes the appearance while the h1..h6 hierarchy underneath stays correct."
          >
            <HeadingDecoupleStyles />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Typography"
        n="Use the drop-in typography components for titles and text blocks in an app."
      >
        <Grid>
          <Tile
            span={12}
            name="Typography Display Blocks"
            rule="Fraunces on Base's four display sizes gives Rocoto's highest-level titles a calm editorial voice."
          >
            <TypographyDisplay />
          </Tile>
          <Tile
            span={6}
            name="Typography Heading Blocks"
            rule="Fraunces across six semantic heading sizes, from XXLarge down to XSmall."
          >
            <TypographyHeading />
          </Tile>
          <Tile
            span={6}
            name="Typography Body Blocks"
            rule="Inter labels and paragraphs at four sizes each keep product copy and operational detail crisp."
          >
            <TypographyText />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Divider"
        n="Visual rules that separate sections of content, in three weights: cell at 1px, section at 2px, module at 8px."
      >
        <Grid>
          <Tile
            span={6}
            name="Basic"
            rule="Cell divides list items, section divides groups of them, and module divides larger clusters."
          >
            <DividerBasic />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Block"
        n="A helper for the one-off layout and typography elements that get written inline."
      >
        <Grid>
          <Tile
            span={4}
            name="Block basic Usage"
            rule="Layout and spacing props go straight onto the element, with no named component in between."
          >
            <BlockBasic />
          </Tile>
          <Tile
            span={4}
            name="Responsive Properties"
            rule="An array of values becomes a media query per theme breakpoint — 320, 600 and 1136 by default. Resize the window to move it."
          >
            <BlockResponsive />
          </Tile>
          <Tile
            span={4}
            name="Overrides"
            rule="`as` picks the element and the Block override supplies the style, so semantics and appearance stay separable."
          >
            <BlockOverride />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Icon"
        n="Use icons to save room in a tight interface and to point people where they need to go."
      >
        <Grid>
          <Tile
            span={4}
            name="Icon basic usage"
            rule="Icons take their fill from the surrounding colour, so a wrapper is all it takes to set them."
          >
            <IconBasic />
          </Tile>
          <Tile
            span={4}
            name="Icon in a button"
            rule="startEnhancer, endEnhancer, or the icon alone as the button's only child. `title=&quot;&quot;` hides a decorative icon from assistive technology."
          >
            <IconButton />
          </Tile>
          <Tile
            span={12}
            name="Available icons"
            rule="Every icon Base ships, listed from baseui/icon/icon-exports along with the import that reaches it."
          >
            <IconList />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
