/* CONTENT — Base Web's own examples, running under the Rocoto theme.
 *
 * Eight components ship here, in the order the kit lists them: Card, Accordion, Tabs, Tabs
 * (Motion), Tag, Tag Group, Avatar, Badge. Every example file under bw-docs/examples/{card,
 * accordion,tabs,tabs-motion,tag,tag-group,avatar,badge} becomes one Tile — 49 of them.
 *
 * THE DEMO COPY IS UBER'S OWN, VERBATIM — the lorem ipsum, the Dune quotes, `Tab Link 1`,
 * `Han Solo`, `Dining nearby`, `Mohamed Naguib Station`. The kit is grammar, not sentences: a
 * themed demo would pre-decide which control serves which moment of the product, and that decision
 * belongs to the situations catalogue, later and explicitly.
 *
 * The edits to Uber's code are two, and only two:
 *   (a) docs-site-local imports become chrome or inline (baseui/layout-grid's `Grid` is imported
 *       as `LayoutGrid` so it does not collide with the kit's own `Grid`);
 *   (b) each example keeps its own hooks and its own styled elements, so each is its own function
 *       component, renamed so all forty-nine can share one module.
 *
 * COLOUR: the theme re-inks. Base's `kind="negative"`, `kind="positive"`, `COLOR.positive` and the
 * ten Tag hues stay exactly as Uber wrote them and come out INK — that is the theme working, not a
 * bug, and it is why the kinds, hierarchy and wrap demos ship whole. Where an example hard-codes a
 * colour OUTSIDE the theme's reach (`background: 'green'` on the tab hover override, a literal
 * blue on the custom-colour tag, `1px solid grey` on the badge offset frame), the theme cannot
 * re-ink it, so the value is re-sourced from the theme. Marked ↯ at each site.
 *
 * IMAGES: three examples load from hosts that no longer answer — `source.unsplash.com` (both
 * picture cards) and `avatars.dicebear.com` (avatar sizes, avatar overrides, badge offset). The
 * kit page also runs offline. Each is redrawn as an inline data-URI SVG in the theme's own two
 * colours, and drawn as nothing in particular: a crossed frame where the photo went, a generic
 * bust where the portrait went. The deliberately broken `https://not-a-real-image.png` in
 * avatar/error.tsx and avatar/override.tsx STAYS broken — the fallback IS that example.
 *
 * ONE PROP THIS BUILD DOES NOT HAVE: `noMargin` arrives on Tag after baseui@16.1.1 (it is in
 * bw-src/src/tag, absent from the installed module, whose Root hard-codes 5px on all four sides).
 * Upstream it sets those four margins to zero and nothing else, so the Tile does exactly that
 * through the Root override and says so. See ↯ at tag/no-margin.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';

import { useStyletron, styled } from 'baseui';
import { expandBorderStyles } from 'baseui/styles';
import type { StyleObject } from 'styletron-standard';

import { Card, StyledBody, StyledAction, StyledThumbnail } from 'baseui/card';
import { Accordion, Panel, StatefulPanel, StatelessAccordion } from 'baseui/accordion';
import { Tabs, Tab, StatefulTabs, StyledTab, ORIENTATION } from 'baseui/tabs';
import {
  Tabs as TabsMotion,
  Tab as TabMotion,
  StatefulTabs as StatefulTabsMotion,
  StyledTabList,
  StyledTabPanel,
  FILL,
  ORIENTATION as ORIENTATION_MOTION,
} from 'baseui/tabs-motion';
import { Tag, KIND as TAG_KIND, HIERARCHY as TAG_HIERARCHY, SIZE as TAG_SIZE, SUPPORTED_KIND } from 'baseui/tag';
import { TagGroup, HIERARCHY as GROUP_HIERARCHY, SIZE as GROUP_SIZE } from 'baseui/tag-group';
import { Avatar } from 'baseui/avatar';
import { Badge, SHAPE, COLOR, PLACEMENT, HIERARCHY as BADGE_HIERARCHY } from 'baseui/badge';

import { Button, SIZE as BUTTON_SIZE, SHAPE as BUTTON_SHAPE } from 'baseui/button';
import { Grid as LayoutGrid, Cell } from 'baseui/layout-grid';
import { ArrowUp, Check } from 'baseui/icon';
import { LabelMedium, LabelSmall, HeadingSmall, ParagraphSmall } from 'baseui/typography';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * UBER'S OWN TEXT — hoisted exactly where the examples hoist it, so the several examples that
 * share one `content` const here share the same one they share upstream.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* the accordion examples' shared body (accordion/basic, title, renderpanelcontent, stateful-panel) */
const ACCORDION_CONTENT =
  'Praesent condimentum ante ac ipsum aliquam, ac scelerisque velit sagittis. Ut sit amet libero ' +
  'scelerisque, accumsan ante vitae, hendrerit tellus. Nullam metus est, vehicula a aliquet id, ' +
  'lobortis in mauris.';

/* the card examples' shared body (card/basic, image-cta, thumbnail-cta) */
const CARD_CONTENT =
  'Proin ut dui sed metus pharetra hend rerit vel non mi. Nulla ornare faucibus ex, non facilisis ' +
  'nisl.';

/* the three tab panels in tabs/controlled and tabs/overrides */
const TABS_CONTENT = ['Tab Content 1', 'Tab Content 2', 'Tab Content 3'];

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PICTURES — inline, in the theme's colours, drawn as line art and of nothing in particular.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/** the crossed frame that stands in for the photo the card examples used to fetch */
function placeholderImage(width: number, height: number, paper: string, ink: string) {
  const inset = Math.round(Math.min(width, height) * 0.18);
  const stroke = Math.max(4, Math.round(Math.min(width, height) / 50));
  const w = width - inset * 2;
  const h = height - inset * 2;
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" ` +
    `viewBox="0 0 ${width} ${height}">` +
    `<rect width="${width}" height="${height}" fill="${paper}"/>` +
    `<g fill="none" stroke="${ink}" stroke-width="${stroke}">` +
    `<rect x="${inset}" y="${inset}" width="${w}" height="${h}"/>` +
    `<line x1="${inset}" y1="${inset}" x2="${inset + w}" y2="${inset + h}"/>` +
    `<line x1="${inset + w}" y1="${inset}" x2="${inset}" y2="${inset + h}"/>` +
    '</g></svg>';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/** the generic bust that stands in for the portrait service the avatar and badge examples used */
function placeholderPortrait(background: string, foreground: string) {
  const svg =
    '<svg xmlns="http://www.w3.org/2000/svg" width="120" height="120" viewBox="0 0 120 120">' +
    `<rect width="120" height="120" fill="${background}"/>` +
    `<circle cx="60" cy="46" r="19" fill="${foreground}"/>` +
    `<path d="M25 108a35 35 0 0 1 70 0z" fill="${foreground}"/>` +
    '</svg>';
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * CARD — bw-docs/examples/card/*.tsx (3 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* card/basic.tsx */
function CardBasic() {
  return (
    <Card overrides={{ Root: { style: { width: '328px' } } }}>
      <StyledBody>{CARD_CONTENT}</StyledBody>
    </Card>
  );
}

/* card/image-cta.tsx — ↯ headerImage came from source.unsplash.com; the frame is drawn inline. */
function CardWithImageCta() {
  const [, theme] = useStyletron();
  return (
    <Card
      overrides={{ Root: { style: { width: '328px' } } }}
      headerImage={placeholderImage(700, 400, theme.colors.backgroundTertiary, theme.colors.contentPrimary)}
      title="Example card"
    >
      <StyledBody>{CARD_CONTENT}</StyledBody>
      <StyledAction>
        <Button overrides={{ BaseButton: { style: { width: '100%' } } }}>Button Label</Button>
      </StyledAction>
    </Card>
  );
}

/* card/thumbnail-cta.tsx — ↯ same substitution, at the square ratio. */
function CardWithThumbnailCta() {
  const [, theme] = useStyletron();
  return (
    <Card overrides={{ Root: { style: { width: '328px' } } }} title="Example card">
      <StyledThumbnail
        src={placeholderImage(300, 300, theme.colors.backgroundTertiary, theme.colors.contentPrimary)}
      />
      <StyledBody>{CARD_CONTENT}</StyledBody>
      <StyledAction>
        <Button overrides={{ BaseButton: { style: { width: '100%' } } }}>Button Label</Button>
      </StyledAction>
    </Card>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * ACCORDION — bw-docs/examples/accordion/*.tsx (6 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* accordion/custom.tsx */
function AccordionCustomPanelExample() {
  return (
    <Accordion onChange={({ expanded }) => console.log(expanded)}>
      <Panel title="Panel 1">Panel 1 opens correctly</Panel>
      <AccordionCustomPanel title="Custom Panel">
        This is a custom panel component
      </AccordionCustomPanel>
    </Accordion>
  );
}

function AccordionCustomPanel(props: any) {
  return <Panel {...props} />;
}

/* accordion/basic.tsx */
function AccordionBasic() {
  return (
    <Accordion>
      <Panel title="Accordion panel 1">{ACCORDION_CONTENT}</Panel>
      <Panel title="Accordion panel 2">{ACCORDION_CONTENT}</Panel>
      <Panel title="Accordion panel 3">{ACCORDION_CONTENT}</Panel>
    </Accordion>
  );
}

/* accordion/title.tsx — Uber's third title reads `Custom Title 2` as well; it is left as written. */
function AccordionCustomTitle() {
  const [css] = useStyletron();
  return (
    <Accordion>
      <Panel
        title={
          <div className={css({ display: 'flex', alignItems: 'center' })}>
            <ArrowUp size={24} />
            Custom Title 1
          </div>
        }
      >
        {ACCORDION_CONTENT}
      </Panel>

      <Panel
        title={
          <div className={css({ display: 'flex', alignItems: 'center' })}>
            <ArrowUp size={24} />
            Custom Title 2
          </div>
        }
      >
        {ACCORDION_CONTENT}
      </Panel>

      <Panel
        title={
          <div className={css({ display: 'flex', alignItems: 'center' })}>
            <ArrowUp size={24} />
            Custom Title 2
          </div>
        }
      >
        {ACCORDION_CONTENT}
      </Panel>
    </Accordion>
  );
}

/* accordion/renderpanelcontent.tsx */
function AccordionRenderAll() {
  return (
    <Accordion renderAll>
      <Panel title="Accordion panel 1">{ACCORDION_CONTENT}</Panel>
      <Panel title="Accordion panel 2">{ACCORDION_CONTENT}</Panel>
      <Panel title="Accordion panel 3">{ACCORDION_CONTENT}</Panel>
    </Accordion>
  );
}

/* accordion/stateful-panel.tsx */
function AccordionStatefulPanel() {
  return (
    <ul>
      <StatefulPanel title="Expandable panel">{ACCORDION_CONTENT}</StatefulPanel>
    </ul>
  );
}

/* accordion/stateless.tsx */
function AccordionStateless() {
  const [expanded, setExpanded] = React.useState<React.Key[]>(['P1', 'P2']);
  return (
    <StatelessAccordion
      expanded={expanded}
      onChange={({ key, expanded }) => {
        console.log(key);
        setExpanded(expanded);
      }}
    >
      <Panel key="P1" title="Panel 1">
        Lorem ipsum dolor sit amet, consectetur adipiscing elit.
      </Panel>
      <Panel key="P2" title="Panel 2">
        Quisque luctus eu sem et pharetra.
      </Panel>
      <Panel key="P3" title="Panel 3">
        Proin egestas dui sed semper iaculis.
      </Panel>
    </StatelessAccordion>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TABS — bw-docs/examples/tabs/*.tsx (6 examples)
 * Base deprecates this module in favour of Tabs (Motion), which follows. It ships whole anyway:
 * the docs page still renders all six, and the deprecation is a fact about the roadmap, not a
 * reason to show less of the system.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* tabs/controlled.tsx — Uber types the state `string | number`; `onChange` hands back a
 * `React.Key`, which @types/react 18.3 widened to include `bigint`. The state is typed `React.Key`
 * so the two meet, which is what the tabs-motion examples already do. */
function TabsControlled() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('0');
  return (
    <Tabs
      activeKey={activeKey}
      onChange={({ activeKey }) => {
        setActiveKey(activeKey);
      }}
    >
      <Tab title="Tab Link 1">
        <div>{TABS_CONTENT[Number(activeKey)]}</div>
      </Tab>
      <Tab title="Tab Link 2">
        <div>{TABS_CONTENT[Number(activeKey)]}</div>
      </Tab>
      <Tab title="Tab Link 3">
        <div>{TABS_CONTENT[Number(activeKey)]}</div>
      </Tab>
    </Tabs>
  );
}

/* tabs/uncontrolled.tsx */
function TabsUncontrolled() {
  return (
    <StatefulTabs initialState={{ activeKey: '0' }}>
      <Tab title="Tab Link 1">Tab 1 content</Tab>
      <Tab title="Tab Link 2">Tab 2 content</Tab>
      <Tab title="Tab Link 3">Tab 3 content</Tab>
    </StatefulTabs>
  );
}

/* tabs/custom-keys.tsx */
function TabsCustomKeys() {
  const [activeKey, setActiveKey] = React.useState('black');
  return (
    <Tabs activeKey={activeKey} onChange={({ activeKey }) => setActiveKey(String(activeKey))}>
      <Tab key="black" title="Black">
        <span role="img" aria-label="black">
          ⚫️ ️
        </span>
      </Tab>
      <Tab key="white" title="White">
        <span role="img" aria-label="white">
          ⚪️
        </span>
      </Tab>
      <Tab key="blue" title="Blue">
        <span role="img" aria-label="blue">
          🔵
        </span>
      </Tab>
    </Tabs>
  );
}

/* tabs/renderall.tsx */
function TabsRenderAll() {
  return (
    <StatefulTabs initialState={{ activeKey: '0' }} renderAll>
      <Tab title="Tab Link 1">Tab 1 content</Tab>
      <Tab title="Tab Link 2">Tab 2 content</Tab>
      <Tab title="Tab Link 3">Tab 3 content</Tab>
    </StatefulTabs>
  );
}

/* tabs/vertical.tsx */
function TabsVertical() {
  return (
    <StatefulTabs orientation={ORIENTATION.vertical} initialState={{ activeKey: '2' }}>
      <Tab title="Tab Link 1">Tab 1 content</Tab>
      <Tab title="Tab Link 2">Tab 2 content</Tab>
      <Tab title="Tab Link 3">Tab 3 content</Tab>
    </StatefulTabs>
  );
}

/* tabs/overrides.tsx — every colour here is a mono step or `white`, so the theme leaves them
 * exactly as Base drew them and the dashed content border survives the swap untouched. */
function TabsOverrideTab({ children, ...rest }: any) {
  return (
    <StyledTab {...rest}>
      <LabelMedium
        overrides={{
          Block: {
            style: { color: 'inherit', ':hover': { color: 'inherit' } },
          },
        }}
      >
        {children}
      </LabelMedium>
    </StyledTab>
  );
}

const tabsOverrideTabStyle = ({ $active, $disabled, $theme }: any) => ({
  outlineColor: $theme.colors.white,
  color: $active ? $theme.colors.mono100 : $theme.colors.mono300,
  ':hover': $disabled
    ? {}
    : {
        color: $theme.colors.mono100,
      },
  ':focus': $disabled
    ? {}
    : {
        color: $theme.colors.mono100,
      },
});

const tabsOverrideBarStyle = ({ $theme }: any) => ({
  backgroundColor: $theme.colors.mono600,
});

const tabsOverrideContentStyle = ({ $theme }: any): StyleObject => ({
  borderLeftWidth: '2px',
  borderRightWidth: '2px',
  borderBottomWidth: '2px',
  borderTopWidth: '0',
  borderLeftStyle: 'dashed',
  borderRightStyle: 'dashed',
  borderTopStyle: 'dashed',
  borderBottomStyle: 'dashed',
  borderLeftColor: $theme.colors.mono600,
  borderRightColor: $theme.colors.mono600,
  borderTopColor: $theme.colors.mono600,
  borderBottomColor: $theme.colors.mono600,
});

function TabsOverrides() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('0');
  return (
    <StatefulTabs
      initialState={{ activeKey: activeKey }}
      onChange={({ activeKey }) => {
        setActiveKey(activeKey);
      }}
      overrides={{
        TabBar: {
          style: tabsOverrideBarStyle,
        },
        TabContent: {
          style: tabsOverrideContentStyle,
        },
        Tab: { component: TabsOverrideTab, style: tabsOverrideTabStyle },
      }}
    >
      <Tab title="Tab Link 1">
        <div>{TABS_CONTENT[Number(activeKey)]}</div>
      </Tab>
      <Tab title="Tab Link 2">
        <div>{TABS_CONTENT[Number(activeKey)]}</div>
      </Tab>
      <Tab title="Tab Link 3">
        <div>{TABS_CONTENT[Number(activeKey)]}</div>
      </Tab>
    </StatefulTabs>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TABS (MOTION) — bw-docs/examples/tabs-motion/*.tsx (13 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* tabs-motion/basic.tsx */
function MotionBasic() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion activeKey={activeKey} onChange={({ activeKey }) => setActiveKey(activeKey)}>
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/keys.tsx */
function MotionKeys() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('first');
  return (
    <TabsMotion activeKey={activeKey} onChange={({ activeKey }) => setActiveKey(activeKey)}>
      <TabMotion key="first" title="First">
        I must not fear.
      </TabMotion>
      <TabMotion key="second" title="Second">
        Fear is the mind-killer.
      </TabMotion>
      <TabMotion key="third" title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/keyboard-activation.tsx */
function MotionKeyboardActivation() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      activateOnFocus={false}
    >
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/enhancer.tsx */
function MotionEnhancer() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      endEnhancer={
        <Button size={BUTTON_SIZE.compact} shape={BUTTON_SHAPE.pill}>
          Button
        </Button>
      }
    >
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/vertical-orientation.tsx */
function MotionVertical() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      orientation={ORIENTATION_MOTION.vertical}
    >
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/fixed.tsx */
function MotionFixed() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      fill={FILL.fixed}
    >
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/disabled.tsx */
function MotionDisabled() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      disabled
    >
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/artwork.tsx — the docs say icons from baseui/icon work out of the box, and at
 * runtime they do. In baseui@16.1.1 the two declarations disagree by one null: `TabProps.artwork`
 * asks for a component whose `title` is `string | null | undefined`, while the icons declare
 * `string | undefined`. Uber's example is kept exactly as written and the gap is stated. */
function MotionArtwork() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion activeKey={activeKey} onChange={({ activeKey }) => setActiveKey(activeKey)}>
      <TabMotion
        title="First"
        // @ts-expect-error — baseui@16.1.1 declares icon `title` one null narrower than artwork wants
        artwork={Check}
      >
        I must not fear.
      </TabMotion>
      <TabMotion
        title="Second"
        // @ts-expect-error — baseui@16.1.1 declares icon `title` one null narrower than artwork wants
        artwork={Check}
      >
        Fear is the mind-killer.
      </TabMotion>
      <TabMotion
        title="Third"
        // @ts-expect-error — baseui@16.1.1 declares icon `title` one null narrower than artwork wants
        artwork={Check}
      >
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/renderAll.tsx */
function MotionRenderAll() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      renderAll
    >
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/alignment.tsx — baseui/layout-grid's `Grid` is imported as `LayoutGrid` so it does
 * not collide with the kit's own twelve-column `Grid`. */
const MotionAlignmentTabsOverrides = {
  TabList: {
    component: function MotionTabListOverride(props: any) {
      return (
        <LayoutGrid>
          <Cell span={12}>
            <StyledTabList {...props} />
          </Cell>
        </LayoutGrid>
      );
    },
  },
};

const MotionAlignmentTabOverrides = {
  TabPanel: {
    component: function MotionTabPanelOverride(props: any) {
      return (
        <LayoutGrid>
          <Cell span={12}>
            <StyledTabPanel {...props} />
          </Cell>
        </LayoutGrid>
      );
    },
  },
};

function MotionAlignment() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      overrides={MotionAlignmentTabsOverrides}
    >
      <TabMotion title="First" overrides={MotionAlignmentTabOverrides}>
        I must not fear.
      </TabMotion>
      <TabMotion title="Second" overrides={MotionAlignmentTabOverrides}>
        Fear is the mind-killer.
      </TabMotion>
      <TabMotion title="Third" overrides={MotionAlignmentTabOverrides}>
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/refs.tsx — Uber's `React.useRef()` calls carry no type argument; the element types
 * are stated here so the refs land on the props they are handed to. */
function MotionRefs() {
  const [activeKey, setActiveKey] = React.useState<React.Key>(0);
  const tabListRef = React.useRef<HTMLDivElement>(null);
  const firstTabRef = React.useRef<HTMLButtonElement>(null);
  const firstTabPanelRef = React.useRef<HTMLDivElement>(null);
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }) => setActiveKey(activeKey)}
      overrides={{
        TabList: { props: { ref: tabListRef } },
      }}
    >
      <TabMotion
        title="First"
        tabRef={firstTabRef}
        overrides={{
          TabPanel: { props: { ref: firstTabPanelRef } },
        }}
      >
        I must not fear.
      </TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </TabsMotion>
  );
}

/* tabs-motion/stateful.tsx */
function MotionStateful() {
  return (
    <StatefulTabsMotion>
      <TabMotion title="First">I must not fear.</TabMotion>
      <TabMotion title="Second">Fear is the mind-killer.</TabMotion>
      <TabMotion title="Third">
        Fear is the little-death that brings total obliteration.
      </TabMotion>
    </StatefulTabsMotion>
  );
}

/* tabs-motion/tab-override.tsx — ↯ the hover background was the literal `green`, outside the
 * theme's reach. It is re-sourced to backgroundTertiary, so the override still demonstrates a
 * per-tab hover and the page keeps one colour law. */
function MotionTabOverride() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('0');
  return (
    <TabsMotion
      activeKey={activeKey}
      onChange={({ activeKey }: { activeKey: React.Key }) => {
        setActiveKey(activeKey);
      }}
      activateOnFocus
    >
      <TabMotion
        overrides={{
          Tab: {
            style: ({ $theme }) => ({
              ':hover': { background: $theme.colors.backgroundTertiary },
            }),
          },
        }}
        title="First"
      >
        Content 1
      </TabMotion>
      <TabMotion title="Second">Content 2</TabMotion>
      <TabMotion title="Third">Content 3</TabMotion>
    </TabsMotion>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TAG — bw-docs/examples/tag/*.tsx (11 examples)
 *
 * Under this theme all ten hues come out ink and saffron: colour is not a status system here, and
 * a hierarchy of two weights carries what the ten hues used to.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const tagHierarchies = Object.values(TAG_HIERARCHY);
/* Uber names this helper `onClick`; renamed here so eleven examples can share one module. */
const announceTagClick = (kind: string) => alert(`${kind} tag is clicked`);

/* tag/basic.tsx */
function TagBasic() {
  return (
    <React.Fragment>
      <Tag>default</Tag>
      <Tag>long text inside the tag</Tag>
    </React.Fragment>
  );
}

/* tag/kinds.tsx — ↯ Uber's `.map` returns a keyless <div>; the key is added. */
function TagKinds() {
  return (
    <React.Fragment>
      {[
        TAG_KIND.gray,
        TAG_KIND.blue,
        TAG_KIND.green,
        TAG_KIND.red,
        TAG_KIND.yellow,
        TAG_KIND.orange,
        TAG_KIND.purple,
        TAG_KIND.magenta,
        TAG_KIND.teal,
        TAG_KIND.lime,
      ].map((kind) => (
        <div key={kind}>
          <Tag
            kind={kind}
            onClick={() => alert(`click ${kind}`)}
            onActionClick={() => alert(`action ${kind}`)}
          >
            {kind}
          </Tag>
          <Tag
            kind={kind}
            onClick={() => alert(`click ${kind}`)}
            onActionClick={() => alert(`action ${kind}`)}
            hierarchy={TAG_HIERARCHY.primary}
          >
            {kind}
          </Tag>
        </div>
      ))}
    </React.Fragment>
  );
}

/* tag/variants.tsx */
function TagHierarchyExample() {
  return (
    <React.Fragment>
      <React.Fragment>
        <Tag hierarchy="primary">primary</Tag>
      </React.Fragment>

      <React.Fragment>
        <Tag hierarchy="secondary">secondary</Tag>
      </React.Fragment>
    </React.Fragment>
  );
}

/* tag/size.tsx */
function TagSizes() {
  return (
    <React.Fragment>
      <Tag size={TAG_SIZE.small}>small</Tag>
      <Tag size={TAG_SIZE.medium}>medium</Tag>
      <Tag size={TAG_SIZE.large}>large</Tag>
    </React.Fragment>
  );
}

/* tag/non-clickable.tsx */
function TagNonClickable() {
  return (
    <React.Fragment>
      {tagHierarchies.map((hierarchy, index) => (
        <React.Fragment key={index}>
          <Tag hierarchy={hierarchy} kind="neutral">
            neutral
          </Tag>

          <Tag hierarchy={hierarchy} kind="primary">
            primary
          </Tag>

          <Tag hierarchy={hierarchy} kind="accent">
            accent
          </Tag>

          <Tag hierarchy={hierarchy} kind="positive">
            positive
          </Tag>

          <Tag hierarchy={hierarchy} kind="warning">
            warning
          </Tag>

          <Tag hierarchy={hierarchy} kind="negative">
            negative
          </Tag>
          <br />
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/* tag/clickable.tsx */
function TagClickable() {
  return (
    <React.Fragment>
      {tagHierarchies.map((hierarchy, index) => (
        <React.Fragment key={index}>
          <Tag
            onClick={() => {
              announceTagClick('neutral');
            }}
            hierarchy={hierarchy}
            kind="neutral"
          >
            neutral
          </Tag>
          <Tag
            onClick={() => {
              announceTagClick('primary');
            }}
            hierarchy={hierarchy}
            kind="primary"
          >
            primary
          </Tag>
          <Tag
            onClick={() => {
              announceTagClick('accent');
            }}
            hierarchy={hierarchy}
            kind="accent"
          >
            accent
          </Tag>
          <Tag
            onClick={() => {
              announceTagClick('positive');
            }}
            hierarchy={hierarchy}
            kind="positive"
          >
            positive
          </Tag>
          <Tag
            onClick={() => {
              announceTagClick('warning');
            }}
            hierarchy={hierarchy}
            kind="warning"
          >
            warning
          </Tag>
          <Tag
            onClick={() => {
              announceTagClick('negative');
            }}
            hierarchy={hierarchy}
            kind="negative"
          >
            negative
          </Tag>
          <br />
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/* tag/disabled.tsx */
function TagDisabled() {
  return (
    <React.Fragment>
      {tagHierarchies.map((hierarchy, index) => (
        <React.Fragment key={index}>
          <Tag
            disabled
            onClick={() => {
              announceTagClick('neutral');
            }}
            hierarchy={hierarchy}
            kind="neutral"
          >
            neutral
          </Tag>
          <Tag
            disabled
            onClick={() => {
              announceTagClick('primary');
            }}
            hierarchy={hierarchy}
            kind="primary"
          >
            primary
          </Tag>
          <Tag
            disabled
            onClick={() => {
              announceTagClick('accent');
            }}
            hierarchy={hierarchy}
            kind="accent"
          >
            accent
          </Tag>
          <Tag
            disabled
            onClick={() => {
              announceTagClick('positive');
            }}
            hierarchy={hierarchy}
            kind="positive"
          >
            positive
          </Tag>
          <Tag
            disabled
            onClick={() => {
              announceTagClick('warning');
            }}
            hierarchy={hierarchy}
            kind="warning"
          >
            warning
          </Tag>
          <Tag
            disabled
            onClick={() => {
              announceTagClick('negative');
            }}
            hierarchy={hierarchy}
            kind="negative"
          >
            negative
          </Tag>
          <br />
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/* tag/non-closeable.tsx */
function TagNonCloseable() {
  return (
    <React.Fragment>
      {tagHierarchies.map((hierarchy, index) => (
        <React.Fragment key={index}>
          <Tag closeable={false} hierarchy={hierarchy} kind="neutral">
            neutral
          </Tag>

          <Tag closeable={false} hierarchy={hierarchy} kind="primary">
            primary
          </Tag>

          <Tag closeable={false} hierarchy={hierarchy} kind="accent">
            accent
          </Tag>

          <Tag closeable={false} hierarchy={hierarchy} kind="positive">
            positive
          </Tag>

          <Tag closeable={false} hierarchy={hierarchy} kind="warning">
            warning
          </Tag>

          <Tag closeable={false} hierarchy={hierarchy} kind="negative">
            negative
          </Tag>
          <br />
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/* tag/clickable-non-closeable.tsx */
function TagClickableNonCloseable() {
  return (
    <React.Fragment>
      {tagHierarchies.map((hierarchy, index) => (
        <React.Fragment key={index}>
          <Tag
            closeable={false}
            onClick={() => {
              announceTagClick('neutral');
            }}
            hierarchy={hierarchy}
            kind="neutral"
          >
            neutral
          </Tag>
          <Tag
            closeable={false}
            onClick={() => {
              announceTagClick('primary');
            }}
            hierarchy={hierarchy}
            kind="primary"
          >
            primary
          </Tag>
          <Tag
            closeable={false}
            onClick={() => {
              announceTagClick('accent');
            }}
            hierarchy={hierarchy}
            kind="accent"
          >
            accent
          </Tag>
          <Tag
            closeable={false}
            onClick={() => {
              announceTagClick('positive');
            }}
            hierarchy={hierarchy}
            kind="positive"
          >
            positive
          </Tag>
          <Tag
            closeable={false}
            onClick={() => {
              announceTagClick('warning');
            }}
            hierarchy={hierarchy}
            kind="warning"
          >
            warning
          </Tag>
          <Tag
            closeable={false}
            onClick={() => {
              announceTagClick('negative');
            }}
            hierarchy={hierarchy}
            kind="negative"
          >
            negative
          </Tag>
          <br />
        </React.Fragment>
      ))}
    </React.Fragment>
  );
}

/* tag/custom-color.tsx — ↯ Uber passes a literal blue, a hue outside the theme's reach.
 * `KIND.custom` exists to take a colour from outside the palette, and this product has exactly one
 * such colour, so the demo takes saffron from the theme rather than a hex from the example. */
function TagCustomColor() {
  const [, theme] = useStyletron();
  return (
    <React.Fragment>
      <Tag
        color={theme.colors.accent}
        hierarchy={TAG_HIERARCHY.primary}
        kind={TAG_KIND.custom}
        onClick={() => {}}
      >
        custom
      </Tag>
      <br />
      <Tag color={theme.colors.accent} kind={TAG_KIND.custom} onClick={() => {}}>
        custom
      </Tag>
      <br />
      <Tag
        color={theme.colors.accent}
        hierarchy={TAG_HIERARCHY.secondary}
        kind={TAG_KIND.custom}
        onClick={() => {}}
      >
        custom
      </Tag>
    </React.Fragment>
  );
}

/* tag/no-margin.tsx — ↯ `noMargin` lands on Tag after baseui@16.1.1; the installed Root hard-codes
 * 5px on all four sides. Upstream the prop zeroes exactly those four values and changes nothing
 * else (bw-src/src/tag/styled-components.ts:463-466), so the Root override below is that prop,
 * spelled out. Swap it for `noMargin` the day the page moves to a later major. */
const noMarginOverrides = {
  Root: {
    style: {
      marginTop: '0',
      marginRight: '0',
      marginBottom: '0',
      marginLeft: '0',
    },
  },
};

function TagNoMargin() {
  return (
    <div style={{ display: 'flex' }}>
      <Tag overrides={noMarginOverrides}>no margin</Tag>
      <Tag overrides={noMarginOverrides}>no margin</Tag>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TAG GROUP — bw-docs/examples/tag-group/*.tsx (3 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const TagGroupHierarchyContainer = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
});

/* tag-group/hierachy.tsx */
function TagGroupHierarchy() {
  return (
    <TagGroupHierarchyContainer>
      {Object.values(GROUP_HIERARCHY).map((hierarchy) => (
        <TagGroup hierarchy={hierarchy} key={hierarchy}>
          {Object.values(SUPPORTED_KIND)
            .filter((kind) => kind !== SUPPORTED_KIND.custom)
            .map((kind) => (
              <Tag key={kind} kind={kind}>
                {kind}
              </Tag>
            ))}
        </TagGroup>
      ))}
    </TagGroupHierarchyContainer>
  );
}

const TagGroupSizeContainer = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '32px',
});

const TagGroupSizeRow = styled('div', {
  display: 'flex',
  flexDirection: 'column',
  gap: '8px',
});

/* tag-group/size.tsx */
function TagGroupSizes() {
  return (
    <TagGroupSizeContainer>
      {Object.values(GROUP_SIZE).map((size) => (
        <TagGroupSizeRow key={size}>
          <LabelSmall>{size}</LabelSmall>
          <TagGroup size={size}>
            <Tag>gray</Tag>
            <Tag kind="red">red</Tag>
          </TagGroup>
        </TagGroupSizeRow>
      ))}
    </TagGroupSizeContainer>
  );
}

/* tag-group/wrap.tsx — the widest demo Base ships for this component: eight blocks at four
 * container widths, twice. */
const TAG_LONG_TEXT = 'A very long tag text to test wrapping behavior';

function TagGroupWrap() {
  const [css] = useStyletron();
  return (
    <React.Fragment>
      <HeadingSmall>Wrap: true (default)</HeadingSmall>

      <ParagraphSmall>no width set on container</ParagraphSmall>
      <TagGroup>
        {Object.values(SUPPORTED_KIND)
          .filter((kind) => kind !== SUPPORTED_KIND.custom)
          .map((kind) => (
            <Tag key={kind} kind={kind}>
              {kind}
            </Tag>
          ))}
      </TagGroup>

      <ParagraphSmall>width set to 300px on container </ParagraphSmall>
      <div className={css({ width: '300px' })}>
        <TagGroup>
          {Object.values(SUPPORTED_KIND)
            .filter((kind) => kind !== SUPPORTED_KIND.custom)
            .map((kind) => (
              <Tag key={kind} kind={kind}>
                {kind}
              </Tag>
            ))}
        </TagGroup>
      </div>

      <ParagraphSmall>width set to 300px on container and tag with long text </ParagraphSmall>
      <div className={css({ width: '300px' })}>
        <TagGroup>
          {Object.values(SUPPORTED_KIND)
            .filter((kind) => kind !== SUPPORTED_KIND.custom)
            .map((kind, index) => (
              <Tag key={kind} kind={kind}>
                {index === 1 ? TAG_LONG_TEXT : kind}
              </Tag>
            ))}
        </TagGroup>
      </div>

      <ParagraphSmall>
        width set to 100px(smaller than tag text default max width) on container and tag with long
        text - very extreme case
      </ParagraphSmall>
      <div className={css({ marginBottom: '40px', width: '100px' })}>
        <TagGroup>
          {Object.values(SUPPORTED_KIND)
            .filter((kind) => kind !== SUPPORTED_KIND.custom)
            .map((kind, index) => (
              <Tag key={kind} kind={kind}>
                {index === 1 ? TAG_LONG_TEXT : kind}
              </Tag>
            ))}
        </TagGroup>
      </div>

      <HeadingSmall>Wrap: false</HeadingSmall>
      <ParagraphSmall>no width set on container</ParagraphSmall>
      <TagGroup>
        {Object.values(SUPPORTED_KIND)
          .filter((kind) => kind !== SUPPORTED_KIND.custom)
          .map((kind) => (
            <Tag key={kind} kind={kind}>
              {kind}
            </Tag>
          ))}
      </TagGroup>

      <ParagraphSmall>width set to 300px on container </ParagraphSmall>
      <div className={css({ width: '300px' })}>
        <TagGroup wrap={false}>
          {Object.values(SUPPORTED_KIND)
            .filter((kind) => kind !== SUPPORTED_KIND.custom)
            .map((kind) => (
              <Tag key={kind} kind={kind}>
                {kind}
              </Tag>
            ))}
        </TagGroup>
      </div>

      <ParagraphSmall>width set to 300px on container and tag with long text </ParagraphSmall>
      <div className={css({ marginBottom: '40px', width: '300px' })}>
        <TagGroup wrap={false}>
          {Object.values(SUPPORTED_KIND)
            .filter((kind) => kind !== SUPPORTED_KIND.custom)
            .map((kind, index) => (
              <Tag key={kind} kind={kind}>
                {index === 1 ? TAG_LONG_TEXT : kind}
              </Tag>
            ))}
        </TagGroup>
      </div>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * AVATAR — bw-docs/examples/avatar/*.tsx (4 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* avatar/sizes.tsx — ↯ each src came from avatars.dicebear.com, which no longer answers; the
 * bust is drawn inline, in the theme's inverse pair. Uber's `.map` takes the index only to build
 * a different portrait URL per avatar, so with one local drawing it goes. */
function AvatarSizes() {
  const [, theme] = useStyletron();
  return (
    <React.Fragment>
      {['scale800', 'scale1000', 'scale1200', 'scale1400', '64px'].map((size) => (
        <Avatar
          name={`user`}
          size={size}
          src={placeholderPortrait(
            theme.colors.backgroundInversePrimary,
            theme.colors.contentInversePrimary
          )}
          key={size}
        />
      ))}
    </React.Fragment>
  );
}

/* avatar/error.tsx — the src stays broken on purpose: the fallback IS this example. */
function AvatarError() {
  return (
    <React.Fragment>
      {['scale800', 'scale1000', 'scale1200', 'scale1400', '64px'].map((size) => (
        <Avatar name={`user`} size={size} src="https://not-a-real-image.png" key={size} />
      ))}
    </React.Fragment>
  );
}

/* avatar/initials.tsx */
function AvatarInitials() {
  return (
    <React.Fragment>
      {['scale1000', 'scale1200', 'scale1400', '64px'].map((size) => (
        <Avatar name={`Han Solo`} size={size} key={size} />
      ))}
    </React.Fragment>
  );
}

/* avatar/override.tsx — four avatars: two load, two fall back to initials. ↯ the two that load
 * came from dicebear and are drawn inline; the two broken ones stay broken. */
function AvatarOverride() {
  const [css, theme] = useStyletron();
  const portrait = () =>
    placeholderPortrait(
      theme.colors.backgroundInversePrimary,
      theme.colors.contentInversePrimary
    );
  return (
    <React.Fragment>
      <div className={css({ display: 'flex', alignItems: 'center' })}>
        <Avatar
          overrides={{
            Root: {
              style: ({ $theme }) => ({
                ...expandBorderStyles($theme.borders.border500),
              }),
            },
          }}
          name="user name #1"
          size="scale1400"
          src={portrait()}
        />

        <Avatar
          overrides={{
            Root: {
              style: ({ $theme }) => ({
                ...expandBorderStyles($theme.borders.border500),
              }),
            },
          }}
          name="beyonce knowles"
          size="scale1400"
          src="https://not-a-real-image.png"
        />
      </div>
      <div className={css({ display: 'flex', alignItems: 'center' })}>
        <Avatar
          overrides={{
            Avatar: {
              style: ({ $theme }) => ({
                borderTopLeftRadius: $theme.borders.radius100,
                borderTopRightRadius: $theme.borders.radius100,
                borderBottomRightRadius: $theme.borders.radius100,
                borderBottomLeftRadius: $theme.borders.radius100,
              }),
            },
            Root: {
              style: ({ $theme }) => ({
                borderTopLeftRadius: $theme.borders.radius100,
                borderTopRightRadius: $theme.borders.radius100,
                borderBottomRightRadius: $theme.borders.radius100,
                borderBottomLeftRadius: $theme.borders.radius100,
              }),
            },
          }}
          name="user name #3"
          size="scale1400"
          src={portrait()}
        />

        <Avatar
          overrides={{
            Avatar: {
              style: ({ $theme }) => ({
                borderTopLeftRadius: $theme.borders.radius100,
                borderTopRightRadius: $theme.borders.radius100,
                borderBottomRightRadius: $theme.borders.radius100,
                borderBottomLeftRadius: $theme.borders.radius100,
              }),
            },
            Root: {
              style: ({ $theme }) => ({
                borderTopLeftRadius: $theme.borders.radius100,
                borderTopRightRadius: $theme.borders.radius100,
                borderBottomRightRadius: $theme.borders.radius100,
                borderBottomLeftRadius: $theme.borders.radius100,
              }),
            },
          }}
          name="beyonce knowles"
          size="scale1400"
          src="https://not-a-real-image.png"
        />
      </div>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * BADGE — bw-docs/examples/badge/*.tsx (3 examples)
 * `COLOR.positive` stays exactly as Uber wrote it and comes out ink — the theme re-inks, and a
 * badge that reads as a status light is the thing this product is built to do without.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* badge/primary-inline.tsx */
function BadgePrimaryInline() {
  return (
    <React.Fragment>
      Dining nearby <Badge color={COLOR.positive} content="New" />
    </React.Fragment>
  );
}

/* badge/secondary-inline.tsx */
function BadgeSecondaryInline() {
  return (
    <React.Fragment>
      <div>Mohamed Naguib Station</div>
      <div>
        <Badge
          hierarchy={BADGE_HIERARCHY.secondary}
          overrides={{ Badge: { style: { marginRight: '8px' } } }}
          content="7 min"
        />

        <Badge hierarchy={BADGE_HIERARCHY.secondary} content="Closest stop" />
      </div>
    </React.Fragment>
  );
}

/* badge/offset.tsx — ↯ two substitutions: the frame's `1px solid grey` is re-sourced from the
 * theme, and the avatar came from dicebear. */
function BadgeOffset() {
  const [, theme] = useStyletron();
  const styles = {
    height: '140px',
    width: '140px',
    border: `1px solid ${theme.colors.borderOpaque}`,
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'center',
  };
  return (
    <React.Fragment>
      <Badge
        content="Promotion"
        shape={SHAPE.pill}
        color={COLOR.positive}
        placement={PLACEMENT.bottomEdge}
        verticalOffset="8px"
      >
        <div style={styles}>
          <Avatar
            name={`user`}
            size={'72px'}
            src={placeholderPortrait(
              theme.colors.backgroundInversePrimary,
              theme.colors.contentInversePrimary
            )}
          />
        </div>
      </Badge>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PAGE
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function ContentSection() {
  return (
    <>
      <Section
        t="Card"
        n="Use it for a self-contained unit of information in a feed or series, carrying text, an optional picture, and one primary action."
      >
        <Grid>
          <Tile name="Card basic usage" span={4}>
            <CardBasic />
          </Tile>
          <Tile
            name="Card with image and call to action"
            rule="headerImage · title · StyledBody · StyledAction"
            span={4}
          >
            <CardWithImageCta />
          </Tile>
          <Tile
            name="Card with thumbnail and call to action"
            rule="StyledThumbnail sits beside the body instead of above it"
            span={4}
          >
            <CardWithThumbnailCta />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Accordion"
        n="Use it to list high-level options that expand and contract to reveal more detailed information."
      >
        <Grid>
          <Tile name="Custom Accordion" rule="a Panel wrapped in your own component" span={6}>
            <AccordionCustomPanelExample />
          </Tile>
          <Tile name="Accordion basic usage" span={6}>
            <AccordionBasic />
          </Tile>
          <Tile name="Accordion custom title" rule="title takes a node, not just a string" span={6}>
            <AccordionCustomTitle />
          </Tile>
          <Tile
            name="Accordion SEO Friendly"
            rule="renderAll — every panel's content is in the markup before it opens"
            span={6}
          >
            <AccordionRenderAll />
          </Tile>
          <Tile name="Using a stateful panel component on its own" span={6}>
            <AccordionStatefulPanel />
          </Tile>
          <Tile
            name="Stateless Accordion"
            rule="expanded is a list of keys you hold; two panels open at once"
            span={6}
          >
            <AccordionStateless />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Tabs"
        n="Use it to navigate frequently accessed but distinct categories — Base has since replaced this module with Tabs (Motion), which follows."
      >
        <Grid>
          <Tile name="Controlled Tabs Usage" span={6}>
            <TabsControlled />
          </Tile>
          <Tile name="Uncontrolled Tabs Usage" rule="StatefulTabs holds activeKey" span={6}>
            <TabsUncontrolled />
          </Tile>
          <Tile
            name="With Custom Keys"
            rule="tab order supplies default keys; these three carry their own"
            span={6}
          >
            <TabsCustomKeys />
          </Tile>
          <Tile name="Tabs SEO Friendly" rule="renderAll" span={6}>
            <TabsRenderAll />
          </Tile>
          <Tile name="Tabs Vertical Usage" rule="ORIENTATION.vertical" span={6}>
            <TabsVertical />
          </Tile>
          <Tile
            name="Tabs Overrides"
            rule="TabBar · TabContent · Tab, each restyled and the Tab swapped for a component"
            span={6}
          >
            <TabsOverrides />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Tabs (Motion)"
        n="Use it to move between groups of related content, with an animated highlight that follows the active tab."
      >
        <Grid>
          <Tile name="Basics" rule="uncontrolled focus wraps at either end of the list" span={6}>
            <MotionBasic />
          </Tile>
          <Tile name="Keys" rule="string or number; the index is the default" span={6}>
            <MotionKeys />
          </Tile>
          <Tile
            name="Keyboard activation"
            rule="activateOnFocus={false} — arrow to move, Enter or Space to open"
            span={6}
          >
            <MotionKeyboardActivation />
          </Tile>
          <Tile name="End Enhancer" rule="horizontal orientation only" span={6}>
            <MotionEnhancer />
          </Tile>
          <Tile
            name="Vertical orientation"
            rule="Up and Down move focus; the page's own scroll pauses"
            span={6}
          >
            <MotionVertical />
          </Tile>
          <Tile name="Fixed fill" rule="FILL.fixed divides the list equally" span={6}>
            <MotionFixed />
          </Tile>
          <Tile name="Disabled" rule="every tab but the active one" span={6}>
            <MotionDisabled />
          </Tile>
          <Tile name="Leading icon" rule="artwork takes any component; baseui/icon works as is" span={6}>
            <MotionArtwork />
          </Tile>
          <Tile name="Rendering & SEO" rule="renderAll mounts every panel at once" span={6}>
            <MotionRenderAll />
          </Tile>
          <Tile
            name="Alignment"
            rule="TabList and TabPanel wrapped in the layout grid, so the border reaches the viewport"
            span={12}
          >
            <MotionAlignment />
          </Tile>
          <Tile
            name="Refs"
            rule="overrides carry refs everywhere; the active tab's button comes through tabRef"
            span={6}
          >
            <MotionRefs />
          </Tile>
          <Tile name="Stateful" span={6}>
            <MotionStateful />
          </Tile>
          <Tile name="Tab Overrides" rule="ArtworkContainer · Tab · TabPanel, per tab" span={6}>
            <MotionTabOverride />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Tag"
        n="Use it to display a collection of concise information as a list of tags, each one actionable."
      >
        <Grid>
          <Tile name="Tag basic Usage" span={4}>
            <TagBasic />
          </Tile>
          <Tile
            name="Supported KIND values"
            rule="gray · blue · green · red · yellow · orange · purple · magenta · teal · lime — all ten come out ink, in two hierarchies"
            span={6}
          >
            <TagKinds />
          </Tile>
          <Tile name="Tag hierarchy Prop Type" rule="primary · secondary" span={4}>
            <TagHierarchyExample />
          </Tile>
          <Tile name="Tag sizing" rule="small · medium · large" span={4}>
            <TagSizes />
          </Tile>
          <Tile
            name="Tag closeable/non-clickable"
            rule="the deprecated kinds, kept because the docs page keeps them"
            span={6}
          >
            <TagNonClickable />
          </Tile>
          <Tile name="Tag closeable/clickable" span={6}>
            <TagClickable />
          </Tile>
          <Tile name="Tag in a disabled state" span={6}>
            <TagDisabled />
          </Tile>
          <Tile name="Tag non-closeable/non-clickable" span={6}>
            <TagNonCloseable />
          </Tile>
          <Tile name="Tag non-closeable/clickable" span={6}>
            <TagClickableNonCloseable />
          </Tile>
          <Tile name="Tag Custom Color example" rule="KIND.custom, taking saffron from the theme" span={4}>
            <TagCustomColor />
          </Tile>
          <Tile
            name="Tag with no margin"
            rule="the 5px on all four sides, removed — spelled as a Root override until noMargin lands"
            span={4}
          >
            <TagNoMargin />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Tag Group"
        n="Use it to group several tags together under one hierarchy, size and wrapping rule."
      >
        <Grid>
          <Tile name="Tag Group hierarchy" rule="primary · secondary, across all ten kinds" span={6}>
            <TagGroupHierarchy />
          </Tile>
          <Tile name="Tag Group size" rule="xSmall · small · medium · large" span={4}>
            <TagGroupSizes />
          </Tile>
          <Tile
            name="Tag Group wrap"
            rule="four container widths, twice — and Base's own last block leaves wrap at its default, which is where the two behaviours read side by side"
            span={12}
          >
            <TagGroupWrap />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Avatar"
        n="Use it to show a person's picture alongside contextual information, or to attribute an action to them."
      >
        <Grid>
          <Tile
            name="Avatar with available sizes"
            rule="scale800 · scale1000 · scale1200 · scale1400 · 64px"
            span={6}
          >
            <AvatarSizes />
          </Tile>
          <Tile
            name="Avatar with error fallback"
            rule="a src that fails falls back to the name's initials, with role=img and an aria-label"
            span={6}
          >
            <AvatarError />
          </Tile>
          <Tile name="Avatar with initials" rule="name alone, with no src" span={6}>
            <AvatarInitials />
          </Tile>
          <Tile name="Avatar with example overrides" rule="border500 · radius100" span={6}>
            <AvatarOverride />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Badge"
        n="Use it as a small supplemental element that highlights feature information or a promotion inside a flow — three words or fewer, and never actionable."
      >
        <Grid>
          <Tile
            name="Primary inline badge"
            rule="inline, so the rectangle reads as a badge rather than a button"
            span={4}
          >
            <BadgePrimaryInline />
          </Tile>
          <Tile name="Secondary inline badge" rule="metadata inside the content" span={4}>
            <BadgeSecondaryInline />
          </Tile>
          <Tile
            name="Offsets"
            rule="PLACEMENT.bottomEdge with verticalOffset='8px'; the offset sets top or bottom by placement"
            span={4}
          >
            <BadgeOffset />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
