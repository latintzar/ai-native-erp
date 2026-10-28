/* BUTTONS — Base Web's own examples, running under the Rocoto theme.
 *
 * Six components ship here: Button, ButtonGroup, ButtonTimed, ButtonDock, SlidingButton,
 * SegmentedControl. Every example file under bw-docs/examples/{button,button-group,button-timed,
 * button-dock,sliding-button,segmented-control} becomes one Tile — 33 of them, including the one
 * the docs site itself never renders (button-group/controlled.tsx is in the examples folder but
 * absent from button-group.mdx; it ships anyway).
 *
 * Every visible string is Uber's own, verbatim. This kit is GRAMMAR, not sentences: a themed demo
 * would pre-decide which control serves which moment of the product, and that decision belongs to
 * the situations catalogue, later and explicitly.
 *
 * The edits to Uber's code are two, and only two:
 *   (a) docs-site-local imports and page-width layout become chrome (Row supplies the gap the
 *       docs page got from its own margins);
 *   (b) each example keeps its own hooks, so each is its own function component, renamed so all
 *       thirty-three can share one module.
 *
 * COLOUR: the theme re-inks. Base's `kind={KIND.dangerPrimary}` stays dangerPrimary here and comes
 * out INK — that is the theme working, not a bug, and it is why the kinds demo ships whole. Where
 * an example hard-codes a colour OUTSIDE the theme's reach (`color: "red"|"blue"|"gold"|"green"`
 * on the timed button's finish marker, a literal grey on the dock's phone frame, `1px solid black`
 * on the button-group rulers), the theme cannot re-ink it, so the value is re-sourced from the
 * theme. The same holds for a corner: a px radius is a brand value the theme owns, so the dock's
 * phone frame takes its radius off `theme.borders` too. Marked ↯ at each site.
 *
 * LABELS THAT ARE PROP VALUES: in kinds.tsx and sizes.tsx the button's label is the prop value
 * being demonstrated (`primary`, `dangerTertiary`, `xSmall`). Those carry the only information the
 * demo has. Same for the shape/state mappings, which are carried in each Tile's rule line.
 *
 * SLIDING BUTTON: baseui@16.1.1 does not ship `baseui/sliding-button` — the component lands in a
 * later major. Rather than move the whole page onto baseui@18 mid-build (ten other sections are
 * being written against 16.1.1 right now), Uber's own sliding-button source is vendored below,
 * verbatim from bw-src/src/sliding-button/, and rendered through THIS app's baseui@16 `styled` and
 * `getOverrides` — so it draws every colour, radius, sizing step and timing curve from the Rocoto
 * theme exactly as the shipped component would. See the block marked VENDORED.
 */
import * as React from 'react';
import { Section, Tile, Grid, Row } from '../chrome';

import { useStyletron } from 'baseui';
import { styled } from 'baseui/styles';
import { getOverrides } from 'baseui/helpers/overrides';
import type { StyleObject } from 'styletron-standard';

import { Button, KIND, SIZE, SHAPE, WIDTH_TYPE } from 'baseui/button';
import { ButtonGroup, StatefulButtonGroup, MODE, PADDING } from 'baseui/button-group';
import { ButtonTimed } from 'baseui/button-timed';
import { ButtonDock } from 'baseui/button-dock';
import { SegmentedControl, Segment } from 'baseui/segmented-control';
import { Checkbox } from 'baseui/checkbox';
import { StatefulPopover, Popover, PLACEMENT } from 'baseui/popover';
import { StatefulMenu } from 'baseui/menu';
import { ArrowRight, Check, ChevronDown, TriangleDown, Upload } from 'baseui/icon';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * BUTTON — bw-docs/examples/button/*.tsx (10 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* button/basic.tsx */
function ButtonBasic() {
  const [clicked, setClicked] = React.useState(false);

  return (
    <Button onClick={() => setClicked(!clicked)}>{clicked ? 'Clicked!' : 'Click me'}</Button>
  );
}

/* button/kinds.tsx */
function ButtonKinds() {
  return (
    <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
      {Object.values(KIND).map((kind) => (
        <Button key={kind} kind={kind}>
          {kind.charAt(0).toUpperCase() + kind.slice(1)}
        </Button>
      ))}
    </div>
  );
}

/* button/sizes.tsx */
function ButtonSizes() {
  return (
    <div
      style={{
        display: 'flex',
        gap: '8px',
        flexWrap: 'wrap',
        alignItems: 'flex-start',
      }}
    >
      {Object.values(SIZE).map((size) => (
        <Button key={size} size={size}>
          {size.charAt(0).toUpperCase() + size.slice(1)}
        </Button>
      ))}
    </div>
  );
}

/* button/with-enhancers.tsx */
function ButtonWithEnhancers() {
  return (
    <React.Fragment>
      <p>
        <Button startEnhancer={() => <ArrowRight size={24} title="" />}>Start Enhancer</Button>
      </p>
      <p>
        <Button endEnhancer={() => <Upload size={24} title="" />}>End Enhancer</Button>
      </p>
    </React.Fragment>
  );
}

/* button/states.tsx — the docs page spaced these with marginLeft spans; chrome's Row supplies the
 * gap and wraps them at tile width. ↯ layout only. */
function ButtonStates() {
  return (
    <Row>
      <Button>No state</Button>
      <Button isLoading>Loading</Button>
      <Button isSelected>Selected</Button>
      <Button disabled>Disabled</Button>
    </Row>
  );
}

/* button/shapes.tsx */
function ButtonShapes() {
  return (
    <React.Fragment>
      <p>
        <Button>Rectangular shape</Button>
      </p>
      <p>
        <Button shape={SHAPE.rounded}>Rounded shape</Button>
      </p>
      <p>
        <Button shape={SHAPE.square}>
          <Upload />
        </Button>
      </p>
      <p>
        <Button shape={SHAPE.circle}>
          <Upload />
        </Button>
      </p>
    </React.Fragment>
  );
}

/* button/dropdown.tsx — twelve items, so the List override's fixed 150px height demonstrates the
 * scroll. Renamed BUTTON_ITEMS so it does not collide with the button-group example below. */
const BUTTON_ITEMS = [
  { label: 'Item One' },
  { label: 'Item Two' },
  { label: 'Item Three' },
  { label: 'Item Four' },
  { label: 'Item Five' },
  { label: 'Item Six' },
  { label: 'Item Seven' },
  { label: 'Item Eight' },
  { label: 'Item Nine' },
  { label: 'Item Ten' },
  { label: 'Item Eleven' },
  { label: 'Item Twelve' },
];

function ButtonDropdown() {
  return (
    <StatefulPopover
      focusLock
      placement={PLACEMENT.bottomLeft}
      content={({ close }) => (
        <StatefulMenu
          items={BUTTON_ITEMS}
          onItemSelect={() => close()}
          overrides={{
            List: { style: { height: '150px', width: '138px' } },
          }}
        />
      )}
    >
      <Button endEnhancer={() => <ChevronDown size={24} title="" />}>Open Menu</Button>
    </StatefulPopover>
  );
}

/* button/as-an-anchor.tsx */
function ButtonAsAnAnchor() {
  return (
    <React.Fragment>
      {/*
       // @ts-ignore */}
      <Button $as="a" href="https://styletron.org" target="_blank">
        Visit the Styletron docs
      </Button>
    </React.Fragment>
  );
}

/* button/widthTypes.tsx */
function ButtonWidthTypes() {
  return (
    <React.Fragment>
      <p>
        <Button
          startEnhancer={() => <ArrowRight size={24} title="" />}
          endEnhancer={() => <Upload size={24} title="" />}
        >
          Width type: hug(default)
        </Button>
      </p>
      <p>
        <Button
          startEnhancer={() => <ArrowRight size={24} title="" />}
          endEnhancer={() => <Upload size={24} title="" />}
          widthType={WIDTH_TYPE.fill}
        >
          Width type: fill
        </Button>
      </p>
    </React.Fragment>
  );
}

/* button/backgroundSafe.tsx */
function ButtonBackgroundSafe() {
  return (
    <React.Fragment>
      <p>
        <Button
          kind={KIND.secondary}
          startEnhancer={() => <ArrowRight size={24} title="" />}
          endEnhancer={() => <Upload size={24} title="" />}
        >
          BackgroundSafe: off
        </Button>
      </p>
      <p>
        <Button
          kind={KIND.secondary}
          startEnhancer={() => <ArrowRight size={24} title="" />}
          endEnhancer={() => <Upload size={24} title="" />}
          backgroundSafe
        >
          BackgroundSafe: on
        </Button>
      </p>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * BUTTON GROUP — bw-docs/examples/button-group/*.tsx (14 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* button-group/basic.tsx */
function GroupBasic() {
  return (
    <ButtonGroup>
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </ButtonGroup>
  );
}

/* button-group/icon.tsx */
function GroupIcon() {
  return (
    <ButtonGroup>
      <Button>
        <Upload size={24} />
      </Button>
      <Button>
        <Upload size={24} />
      </Button>
      <Button>
        <Upload size={24} />
      </Button>
    </ButtonGroup>
  );
}

/* button-group/enhancer.tsx */
function GroupEnhancer() {
  return (
    <ButtonGroup>
      <Button startEnhancer={() => <Upload size={24} title="" />}>Label</Button>
      <Button startEnhancer={() => <Upload size={24} title="" />}>Label</Button>
      <Button startEnhancer={() => <Upload size={24} title="" />}>Label</Button>
    </ButtonGroup>
  );
}

/* button-group/radio-mode.tsx */
function GroupRadioMode() {
  const [selected, setSelected] = React.useState<number>(-1);
  return (
    <ButtonGroup
      mode={MODE.radio}
      selected={selected}
      onClick={(_event, index) => {
        setSelected(index);
      }}
    >
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </ButtonGroup>
  );
}

/* button-group/checkbox-mode.tsx */
function GroupCheckboxMode() {
  const [selected, setSelected] = React.useState([0, 1]);
  return (
    <ButtonGroup
      mode="checkbox"
      selected={selected}
      onClick={(_event, index) => {
        if (!selected.includes(index)) {
          setSelected([...selected, index]);
        } else {
          setSelected(selected.filter((value) => value !== index));
        }
      }}
    >
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </ButtonGroup>
  );
}

/* button-group/disabled.tsx */
function GroupDisabled() {
  return (
    <ButtonGroup disabled>
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </ButtonGroup>
  );
}

/* button-group/disabled-button.tsx */
function GroupDisabledButton() {
  return (
    <ButtonGroup>
      <Button disabled>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </ButtonGroup>
  );
}

/* button-group/dropdown.tsx */
const GROUP_ITEMS = [
  { label: 'deploy' },
  { label: 'restart' },
  { label: 'scale' },
  { label: 'rollback' },
  { label: 'abort' },
];

// This component is required because of the way that button-group works.
// The button group parent will decorate its children with additional props.
// In Dropdown, we ensure that those props get shuttled to the Button component
// rather than the wrapping StatefulPopover
const GroupDropdownItem = (props: { children: React.ReactNode }) => {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <Popover
      isOpen={isOpen}
      onClick={() => setIsOpen((s) => !s)}
      content={<StatefulMenu items={GROUP_ITEMS} onItemSelect={() => setIsOpen(false)} />}
    >
      <Button {...props} endEnhancer={() => <TriangleDown size={24} title="" />}>
        {props.children}
      </Button>
    </Popover>
  );
};

function GroupDropdown() {
  return (
    <ButtonGroup>
      <Button>First</Button>
      <Button>Second</Button>
      <GroupDropdownItem>Third</GroupDropdownItem>
    </ButtonGroup>
  );
}

/* button-group/stateful-radio.tsx */
function GroupStatefulRadio() {
  return (
    <StatefulButtonGroup mode={MODE.radio} initialState={{ selected: 0 }}>
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </StatefulButtonGroup>
  );
}

/* button-group/stateful-checkbox.tsx */
function GroupStatefulCheckbox() {
  return (
    <StatefulButtonGroup mode={MODE.checkbox} initialState={{ selected: [0, 1] }}>
      <Button>Label</Button>
      <Button>Label</Button>
      <Button>Label</Button>
    </StatefulButtonGroup>
  );
}

/* button-group/wrappable.tsx — ↯ `1px solid black` re-sourced from the theme. */
function GroupWrappable() {
  const [, theme] = useStyletron();
  return (
    <div style={{ width: '200px', border: `1px solid ${theme.colors.borderOpaque}` }}>
      <ButtonGroup wrap={true}>
        <Button>Label</Button>
        <Button>Label</Button>
        <Button>Label</Button>
        <Button>Label</Button>
        <Button>Label</Button>
      </ButtonGroup>
    </div>
  );
}

/* button-group/scrollable.tsx — ↯ `1px solid black` re-sourced from the theme. */
function GroupScrollable() {
  const [, theme] = useStyletron();
  return (
    <div style={{ width: '200px', border: `1px solid ${theme.colors.borderOpaque}` }}>
      <ButtonGroup wrap={false}>
        <Button>Label</Button>
        <Button>Label</Button>
        <Button>Label</Button>
        <Button>Label</Button>
        <Button>Label</Button>
      </ButtonGroup>
    </div>
  );
}

/* button-group/padding.tsx — ↯ `1px solid black` re-sourced from the theme. */
function GroupPadding() {
  const [, theme] = useStyletron();
  const ruler = { width: '400px', maxWidth: '100%', border: `1px solid ${theme.colors.borderOpaque}` };
  return (
    <div>
      <p>Predefined Default Padding</p>
      <div style={ruler}>
        <ButtonGroup padding={PADDING.default}>
          <Button>Label</Button>
          <Button>Label</Button>
          <Button>Label</Button>
        </ButtonGroup>
      </div>

      <p>None Padding</p>
      <div style={ruler}>
        <ButtonGroup padding={PADDING.none}>
          <Button>Label</Button>
          <Button>Label</Button>
          <Button>Label</Button>
        </ButtonGroup>
      </div>

      <p>Customized Padding</p>
      <div style={ruler}>
        <ButtonGroup
          padding={PADDING.custom}
          overrides={{
            Root: {
              style: ({ $theme }) => ({
                paddingLeft: $theme.sizing.scale1000,
                paddingRight: $theme.sizing.scale1000,
              }),
            },
          }}
        >
          <Button>Label</Button>
          <Button>Label</Button>
          <Button>Label</Button>
        </ButtonGroup>
      </div>
    </div>
  );
}

/* button-group/controlled.tsx — in the examples folder, absent from button-group.mdx. It ships. */
function GroupControlled() {
  const [css, theme] = useStyletron();
  const [selected, setSelected] = React.useState(1);
  const [boldClickCount, setBoldClickCount] = React.useState(0);

  const fontWeight = selected === 0 ? theme.typography.font350 : theme.typography.font300;

  return (
    <React.Fragment>
      <ButtonGroup
        selected={selected}
        mode="radio"
        onClick={(_, index) => {
          if (selected !== index) {
            setSelected(index);
          }
        }}
      >
        <Button onClick={() => setBoldClickCount(boldClickCount + 1)}>Bold</Button>
        <Button>Normal</Button>
      </ButtonGroup>

      <div
        className={css({
          ...fontWeight,
          paddingTop: theme.sizing.scale400,
        })}
      >
        Lorem ipsum dolor sit amet, ea insolens deseruisse mnesarchum mea. An munere utroque
        mentitum vis, ea rebum inani iudicabit has. Cu his dolorum perpetua. Mea atqui tation partem
        ne, ei vim etiam volumus nominavi. Cum id atqui cotidieque, quaeque nostrum salutandi cum
        at, idque scaevola platonem mei ad.
      </div>

      <div className={css({ paddingTop: theme.sizing.scale800 })}>
        The Bold option has been selected {boldClickCount} times
      </div>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * BUTTON TIMED — bw-docs/examples/button-timed/paused.tsx (1 example)
 * ↯ The four finish markers were hard-coded red / blue / gold / green, outside the theme's reach.
 * Colour is not a status system in this product, so all four are re-sourced to contentAccent —
 * the saffron that marks the machine's own act, which is exactly what a countdown firing is.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function TimedPaused() {
  const [, theme] = useStyletron();

  const [finished1, setFinished1] = React.useState(false);
  const [finished2, setFinished2] = React.useState(false);
  const [finished3, setFinished3] = React.useState(false);
  const [finished4, setFinished4] = React.useState(false);

  const [paused, setPaused] = React.useState(true);

  const mark = { marginLeft: '20px', color: theme.colors.contentAccent };

  return (
    <div>
      <Button kind={KIND.secondary} onClick={() => setPaused(!paused)}>
        {paused ? 'Run' : 'Pause'}
      </Button>

      <div>
        <ButtonTimed onClick={() => setFinished1(true)} initialTime={10} paused={paused}>
          Countdown
        </ButtonTimed>
        {finished1 && <span style={mark}>Time!</span>}
      </div>

      <div>
        <ButtonTimed onClick={() => setFinished2(true)} initialTime={18} paused={paused}>
          Countdown
        </ButtonTimed>
        {finished2 && <span style={mark}>Time!</span>}
      </div>

      <div>
        <ButtonTimed onClick={() => setFinished3(true)} initialTime={35} paused={paused}>
          Countdown
        </ButtonTimed>
        {finished3 && <span style={mark}>Time!</span>}
      </div>

      <div>
        <ButtonTimed onClick={() => setFinished4(true)} initialTime={60} paused={paused}>
          Countdown
        </ButtonTimed>
        {finished4 && <span style={mark}>Time!</span>}
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * BUTTON DOCK — bw-docs/examples/button-dock/basic.tsx (1 example)
 * ↯ The phone frame hard-coded the same literal grey twice and a px corner once, all outside the
 * theme's reach; all three re-sourced from it.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const StyledIphone6 = styled('div', ({ $theme }) => ({
  width: '375px',
  maxWidth: '100%',
  height: '667px',
  border: `1px solid ${$theme.colors.borderOpaque}`,
  borderRadius: $theme.borders.radius400,
  backgroundColor: $theme.colors.backgroundSecondary,
  overflow: 'auto',
  display: 'flex',
  flexDirection: 'column',
  justifyContent: 'space-between',
}));

const ScrollableContent = styled('div', ({ $theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  overflow: 'auto',
  paddingTop: '8px',
  paddingRight: '8px',
  paddingBottom: '8px',
  paddingLeft: '8px',
  color: $theme.colors.contentPrimary,
  backgroundColor: $theme.colors.backgroundPrimary,
}));

const DockContent = () => {
  return (
    <p>
      Lorem ipsum dolor sit amet, consectetur adipiscing elit, sed do eiusmod tempor incididunt ut
      labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco
      laboris nisi ut aliquip ex ea commodo consequat.
    </p>
  );
};

function DockBasic() {
  return (
    <StyledIphone6>
      <ScrollableContent tabIndex={0}>
        {[...Array(6)].map((_, i) => (
          <DockContent key={i} />
        ))}
      </ScrollableContent>
      <ButtonDock
        topAccessory={<Checkbox>Optional top accessory</Checkbox>}
        primaryAction={<Button>Primary Action</Button>}
        dismissiveAction={<Button kind={KIND.tertiary}>Dismiss</Button>}
        secondaryActions={[
          <Button kind={KIND.secondary} key="first">
            Secondary Action 1
          </Button>,
          <Button kind={KIND.secondary} key="second">
            Secondary Action 2
          </Button>,
        ]}
      />
    </StyledIphone6>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * VENDORED — baseui/sliding-button
 *
 * baseui@16.1.1 has no sliding-button module; it arrives in a later major. Everything from here
 * to the END VENDORED marker is Uber's own source, copied from bw-src/src/sliding-button/
 * (constants.ts, types.ts, default-props.ts, styled-components.ts, sliding-button.tsx) with no
 * behavioural change — only the module boundaries removed and the styled elements prefixed `Sb`
 * so they do not collide inside this file. It runs on THIS app's baseui@16 `styled` and
 * `getOverrides`, so every colour, radius, sizing step and timing curve comes from the Rocoto
 * theme, which is the point of putting it on the page.
 *
 * Copyright (c) Uber Technologies, Inc. — MIT.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const THRESHOLD = {
  low: 'low',
  high: 'high',
} as const;

const THRESHOLD_VALUES: Record<(typeof THRESHOLD)[keyof typeof THRESHOLD], number> = {
  low: 0.2,
  high: 0.8,
};

const GRABBER_ICON_SIZE_PX = 24;
const GRABBER_PADDING_PX = 16;

const BUTTON_SIZE = GRABBER_ICON_SIZE_PX + GRABBER_PADDING_PX * 2; // 56
const TAP_OFFSET = GRABBER_PADDING_PX; // 16

type SbStyleProps = {
  $isDisabled?: boolean;
  $isLoading?: boolean;
  $isCompleted?: boolean;
  $isDragging?: boolean;
  $isInteractive?: boolean;
  $isActuallySliding?: boolean;
  $dragOffset?: number;
  $sliderWidth?: string;
  $isRtl?: boolean;
};

type SlidingButtonProps = {
  /** Text displayed in the button track. */
  label: string;
  /** Completion threshold — 'high' requires 80% drag, 'low' requires 20%. */
  threshold?: keyof typeof THRESHOLD;
  /** Shows loading spinner, disables interaction. */
  isLoading?: boolean;
  /** Grays out the component, disables interaction. */
  isDisabled?: boolean;
  /** Called once when the user drags past the threshold. */
  onComplete?: () => void;
  /** Auto-reset to idle state after N milliseconds. */
  slideBackAfterMs?: number;
  /** Override internal elements. */
  overrides?: { [k: string]: any };
  /** Accessible label — recommended to omit "Slide" for screen readers. */
  'aria-label'?: string;
};

const slidingButtonDefaultProps = {
  threshold: THRESHOLD.high,
  isLoading: false,
  isDisabled: false,
  overrides: {},
};

const SbRoot = styled<'div', SbStyleProps>('div', ({ $theme }) => ({
  width: '100%',
  borderTopLeftRadius: $theme.borders.radius300,
  borderTopRightRadius: $theme.borders.radius300,
  borderBottomLeftRadius: $theme.borders.radius300,
  borderBottomRightRadius: $theme.borders.radius300,
  ':focus': { outline: 'none' },
  ':focus-visible': {
    outline: `3px solid ${$theme.colors.borderAccent}`,
    outlineOffset: '0px',
  },
}));
SbRoot.displayName = 'Root';

const SbTrack = styled<'div', SbStyleProps>('div', ({ $theme, $isDisabled }) => ({
  position: 'relative' as const,
  backgroundColor: $isDisabled
    ? $theme.colors.backgroundStateDisabled
    : $theme.colors.backgroundTertiary,
  borderTopLeftRadius: $theme.borders.radius300,
  borderTopRightRadius: $theme.borders.radius300,
  borderBottomLeftRadius: $theme.borders.radius300,
  borderBottomRightRadius: $theme.borders.radius300,
  height: $theme.sizing.scale1400,
  overflow: 'hidden' as const,
  userSelect: 'none' as const,
  touchAction: 'none' as const,
}));
SbTrack.displayName = 'Track';

const SbLoadingOverlay = styled<'div', SbStyleProps>('div', ({ $theme }) => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  backgroundColor: $theme.colors.backgroundInversePrimary,
  borderTopLeftRadius: $theme.borders.radius300,
  borderTopRightRadius: $theme.borders.radius300,
  borderBottomLeftRadius: $theme.borders.radius300,
  borderBottomRightRadius: $theme.borders.radius300,
}));
SbLoadingOverlay.displayName = 'LoadingOverlay';

const SbLoadingSpinner = styled<'div', SbStyleProps>('div', ({ $theme }) => ({
  width: $theme.sizing.scale700,
  height: $theme.sizing.scale700,
  borderTopLeftRadius: '50%',
  borderTopRightRadius: '50%',
  borderBottomLeftRadius: '50%',
  borderBottomRightRadius: '50%',
  borderLeftWidth: $theme.sizing.scale0,
  borderTopWidth: $theme.sizing.scale0,
  borderRightWidth: $theme.sizing.scale0,
  borderBottomWidth: $theme.sizing.scale0,
  borderLeftStyle: 'solid' as const,
  borderTopStyle: 'solid' as const,
  borderRightStyle: 'solid' as const,
  borderBottomStyle: 'solid' as const,
  borderLeftColor: $theme.colors.borderInverseOpaque,
  borderRightColor: $theme.colors.borderInverseOpaque,
  borderBottomColor: $theme.colors.borderInverseOpaque,
  borderTopColor: $theme.colors.contentInversePrimary,
  boxSizing: 'border-box' as const,
  animationName: {
    from: { transform: 'rotate(0deg)' },
    to: { transform: 'rotate(360deg)' },
  },
  animationDuration: '0.75s',
  animationTimingFunction: 'linear',
  animationIterationCount: 'infinite',
}));
SbLoadingSpinner.displayName = 'LoadingSpinner';

const SbLabel = styled<'div', SbStyleProps>(
  'div',
  ({ $theme, $isDisabled, $isActuallySliding, $isCompleted, $isRtl }) => {
    const startProperty = $isRtl ? 'right' : 'left';
    const endProperty = $isRtl ? 'left' : 'right';
    return {
      position: 'absolute' as const,
      top: '0',
      [startProperty]: $theme.sizing.scale1400,
      [endProperty]: '0',
      bottom: '0',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      color:
        $isDisabled || $isActuallySliding
          ? $theme.colors.contentStateDisabled
          : $theme.colors.contentPrimary,
      opacity: $isCompleted ? 0 : 1,
      transitionProperty: 'opacity, color',
      transitionDuration: $theme.animation.timing200,
      transitionTimingFunction: 'ease-out',
      pointerEvents: 'none' as const,
      ...$theme.typography.LabelLarge,
      fontWeight: 500,
    } as StyleObject;
  }
);
SbLabel.displayName = 'Label';

const SbSlider = styled<'div', SbStyleProps>(
  'div',
  ({ $theme, $isDisabled, $isDragging, $dragOffset, $sliderWidth, $isCompleted, $isRtl }) => {
    const startProperty = $isRtl ? 'right' : 'left';
    const endAlign = $isRtl ? 'flex-start' : 'flex-end';
    const paddingEnd = $isRtl ? 'paddingLeft' : 'paddingRight';
    const suppressTransition = $isDragging && $dragOffset !== TAP_OFFSET;
    return {
      position: 'absolute' as const,
      top: '0',
      [startProperty]: '0',
      bottom: '0',
      width: $sliderWidth,
      backgroundColor: $isDisabled
        ? $theme.colors.backgroundStateDisabled
        : $theme.colors.backgroundInversePrimary,
      borderTopLeftRadius: $theme.borders.radius300,
      borderTopRightRadius: $theme.borders.radius300,
      borderBottomLeftRadius: $theme.borders.radius300,
      borderBottomRightRadius: $theme.borders.radius300,
      display: 'flex',
      alignItems: 'center',
      justifyContent: endAlign,
      [paddingEnd]: $isCompleted ? $theme.sizing.scale600 : '0',
      overflow: 'hidden' as const,
      ...(suppressTransition
        ? { transition: 'none' }
        : {
            transitionProperty: 'width',
            transitionDuration: $theme.animation.timing200,
            transitionTimingFunction: 'ease-out',
          }),
    } as StyleObject;
  }
);
SbSlider.displayName = 'Slider';

const SbCompletedLabel = styled<'div', SbStyleProps>('div', ({ $theme, $isDisabled }) => ({
  position: 'absolute' as const,
  top: '0',
  left: '0',
  right: '0',
  bottom: '0',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: $isDisabled ? $theme.colors.contentStateDisabled : $theme.colors.contentInversePrimary,
  pointerEvents: 'none' as const,
  ...$theme.typography.LabelLarge,
  fontWeight: 500,
}));
SbCompletedLabel.displayName = 'CompletedLabel';

const SbGrabber = styled<'div', SbStyleProps>(
  'div',
  ({ $theme, $isDisabled, $isInteractive }) => ({
    width: $theme.sizing.scale1400,
    height: $theme.sizing.scale1400,
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: $isDisabled ? $theme.colors.contentStateDisabled : $theme.colors.contentInversePrimary,
    cursor: $isInteractive ? 'grab' : 'default',
    touchAction: 'none' as const,
  })
);
SbGrabber.displayName = 'Grabber';

function SlidingButtonInner(
  {
    label,
    threshold = slidingButtonDefaultProps.threshold,
    isLoading = slidingButtonDefaultProps.isLoading,
    isDisabled = slidingButtonDefaultProps.isDisabled,
    onComplete,
    overrides = slidingButtonDefaultProps.overrides,
    slideBackAfterMs,
    'aria-label': ariaLabel,
  }: SlidingButtonProps,
  ref: React.Ref<HTMLDivElement>
) {
  const [, theme] = useStyletron();
  const isRtl = theme.direction === 'rtl';

  const [isDragging, setIsDragging] = React.useState(false);
  const [dragOffset, setDragOffset] = React.useState(0);
  const [isCompleted, setIsCompleted] = React.useState(false);

  const dragStartRef = React.useRef<number>(0);
  const isDraggingRef = React.useRef(false);
  const containerRef = React.useRef<HTMLDivElement>(null);

  const thresholdValue = THRESHOLD_VALUES[threshold];
  const isInteractive = !isDisabled && !isLoading && !isCompleted;

  // -- Pointer handlers -------------------------------------------------------

  const handlePointerDown = React.useCallback(
    (e: React.PointerEvent) => {
      if (!isInteractive) return;
      setIsDragging(true);
      isDraggingRef.current = true;
      setDragOffset(TAP_OFFSET);
      const pos = isRtl ? -e.clientX : e.clientX;
      dragStartRef.current = pos - TAP_OFFSET;
      (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    },
    [isInteractive, isRtl]
  );

  const resetDrag = React.useCallback(() => {
    setIsDragging(false);
    isDraggingRef.current = false;
    if (!isCompleted) {
      setDragOffset(0);
    }
  }, [isCompleted]);

  React.useEffect(() => {
    const handleGlobalPointerMove = (e: PointerEvent) => {
      if (!isDraggingRef.current || !containerRef.current || isCompleted) return;

      const pos = isRtl ? -e.clientX : e.clientX;
      const delta = pos - dragStartRef.current;
      if (delta <= 0) return;

      const containerWidth = containerRef.current.offsetWidth;
      const maxOffset = containerWidth - BUTTON_SIZE;
      const thresholdPixels = containerWidth * thresholdValue;

      if (delta > thresholdPixels) {
        setDragOffset(maxOffset);
        setIsCompleted(true);
        setIsDragging(false);
        isDraggingRef.current = false;
        onComplete?.();
      } else {
        setDragOffset(Math.min(delta, maxOffset));
      }
    };

    const handleGlobalPointerUp = () => {
      setIsDragging(false);
      isDraggingRef.current = false;
      if (!isCompleted) {
        setDragOffset(0);
      }
    };

    if (isDragging) {
      document.addEventListener('pointermove', handleGlobalPointerMove);
      document.addEventListener('pointerup', handleGlobalPointerUp);
      return () => {
        document.removeEventListener('pointermove', handleGlobalPointerMove);
        document.removeEventListener('pointerup', handleGlobalPointerUp);
      };
    }
  }, [isDragging, thresholdValue, isCompleted, onComplete, isRtl]);

  // -- Slide-back timer -------------------------------------------------------

  React.useEffect(() => {
    if (!isCompleted || slideBackAfterMs == null || slideBackAfterMs <= 0) return;
    const timerId = setTimeout(() => {
      setIsCompleted(false);
      setDragOffset(0);
    }, slideBackAfterMs);
    return () => clearTimeout(timerId);
  }, [isCompleted, slideBackAfterMs]);

  // -- Keyboard handler -------------------------------------------------------

  const handleKeyDown = React.useCallback(
    (e: React.KeyboardEvent) => {
      if (!isInteractive) return;
      if (e.key === 'Enter' || e.key === ' ') {
        e.preventDefault();
        setIsCompleted(true);
        onComplete?.();
      }
    },
    [isInteractive, onComplete]
  );

  // -- Early return -----------------------------------------------------------

  if (!label) {
    return null;
  }

  // -- Derived values ---------------------------------------------------------

  const sliderWidth = isCompleted ? '100%' : `${BUTTON_SIZE + dragOffset}px`;
  const isActuallySliding = isDragging && dragOffset > TAP_OFFSET;

  const sharedProps: SbStyleProps = {
    $isDisabled: isDisabled,
    $isLoading: isLoading,
    $isCompleted: isCompleted,
    $isDragging: isDragging,
    $isInteractive: isInteractive,
    $isActuallySliding: isActuallySliding,
    $dragOffset: dragOffset,
    $sliderWidth: sliderWidth,
    $isRtl: isRtl,
  };

  // -- Overrides --------------------------------------------------------------

  const [Root, rootProps] = getOverrides(overrides.Root, SbRoot);
  const [Track, trackProps] = getOverrides(overrides.Track, SbTrack);
  const [SliderEl, sliderProps] = getOverrides(overrides.Slider, SbSlider);
  const [LabelEl, labelProps] = getOverrides(overrides.Label, SbLabel);
  const [CompletedLabelEl, completedLabelProps] = getOverrides(
    overrides.CompletedLabel,
    SbCompletedLabel
  );
  const [GrabberEl, grabberProps] = getOverrides(overrides.Grabber, SbGrabber);
  const [LoadingOverlayEl, loadingOverlayProps] = getOverrides(
    overrides.LoadingOverlay,
    SbLoadingOverlay
  );
  const [LoadingSpinnerEl, loadingSpinnerProps] = getOverrides(
    overrides.LoadingSpinner,
    SbLoadingSpinner
  );

  // -- Aria -------------------------------------------------------------------

  const ariaProps: Record<string, string | boolean | undefined> = {
    'aria-label': ariaLabel || label,
  };
  if (isLoading) {
    ariaProps['aria-busy'] = true;
    ariaProps['aria-live'] = 'polite';
  }
  if (isDisabled) {
    ariaProps['aria-disabled'] = true;
  }

  // -- Render -----------------------------------------------------------------

  return (
    <Root
      ref={ref}
      data-baseweb="sliding-button"
      tabIndex={0}
      role="button"
      onKeyDown={handleKeyDown}
      {...ariaProps}
      {...sharedProps}
      {...rootProps}
    >
      <Track ref={containerRef} {...sharedProps} {...trackProps}>
        {isLoading && (
          <LoadingOverlayEl {...sharedProps} {...loadingOverlayProps}>
            <LoadingSpinnerEl {...sharedProps} {...loadingSpinnerProps} />
          </LoadingOverlayEl>
        )}

        {!isLoading && (
          <>
            <LabelEl {...sharedProps} {...labelProps}>
              {label}
            </LabelEl>

            <SliderEl {...sharedProps} {...sliderProps}>
              {isCompleted && (
                <CompletedLabelEl {...sharedProps} {...completedLabelProps}>
                  {label}
                </CompletedLabelEl>
              )}

              <GrabberEl
                data-baseweb="sliding-button-grabber"
                onPointerDown={handlePointerDown}
                onPointerUp={resetDrag}
                onPointerCancel={resetDrag}
                {...sharedProps}
                {...grabberProps}
              >
                <SlidingArrowIcon isCompleted={isCompleted} />
              </GrabberEl>
            </SliderEl>
          </>
        )}
      </Track>
    </Root>
  );
}

function SlidingArrowIcon({ isCompleted }: { isCompleted: boolean }) {
  if (isCompleted) {
    return <Check title="" size="24px" />;
  }
  return <ArrowRight title="" size="24px" />;
}

const SlidingButton = React.forwardRef<HTMLDivElement, SlidingButtonProps>(SlidingButtonInner);
SlidingButton.displayName = 'SlidingButton';

/* ══════════════════════════════════ END VENDORED ══════════════════════════════════════════ */

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SLIDING BUTTON — bw-docs/examples/sliding-button/*.tsx (3 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* sliding-button/basic.tsx */
function SlidingBasic() {
  return (
    <SlidingButton
      label="Slide to confirm"
      onComplete={() => {
        // eslint-disable-next-line no-console
        console.log('Completed!');
      }}
    />
  );
}

/* sliding-button/states.tsx */
function SlidingStates() {
  const [isLoading, setIsLoading] = React.useState(false);
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: '16px', width: '100%' }}>
      <SlidingButton label="Slide to confirm" onComplete={() => {}} />
      <SlidingButton
        label="Slide to confirm"
        isLoading={isLoading}
        onComplete={() => {
          setIsLoading(true);
          setTimeout(() => setIsLoading(false), 2000);
        }}
      />
      <SlidingButton label="Slide to confirm" isDisabled />
    </div>
  );
}

/* sliding-button/low-threshold.tsx */
function SlidingLowThreshold() {
  return (
    <SlidingButton
      label="Slide to confirm"
      threshold={THRESHOLD.low}
      slideBackAfterMs={1500}
      onComplete={() => {
        // eslint-disable-next-line no-console
        console.log('Completed!');
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SEGMENTED CONTROL — bw-docs/examples/segmented-control/*.tsx (4 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* segmented-control/basic.tsx */
function SegmentedBasic() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('1');
  return (
    <SegmentedControl
      activeKey={activeKey}
      onChange={({ activeKey }) => {
        setActiveKey(activeKey);
      }}
    >
      <Segment key="0" label="Label 1" />
      <Segment key="1" label="Label 2" />
      <Segment key="2" label="Label 3" />
    </SegmentedControl>
  );
}

/* segmented-control/disabled.tsx */
function SegmentedDisabled() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('0');
  return (
    <SegmentedControl
      activeKey={activeKey}
      onChange={({ activeKey }) => {
        setActiveKey(activeKey);
      }}
    >
      <Segment key="0" label="Label 1" />
      <Segment disabled key="1" label="Label 2" />
      <Segment key="2" label="Label 3" />
    </SegmentedControl>
  );
}

/* segmented-control/badge.tsx */
function SegmentedBadge() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('0');
  return (
    <SegmentedControl
      activeKey={activeKey}
      onChange={({ activeKey }) => {
        setActiveKey(activeKey);
      }}
    >
      <Segment key="0" label="Contacts" />
      <Segment key="1" label="Messages" badge={'2'} />
    </SegmentedControl>
  );
}

/* segmented-control/badge-hint.tsx */
function SegmentedBadgeHint() {
  const [activeKey, setActiveKey] = React.useState<React.Key>('0');
  return (
    <SegmentedControl
      activeKey={activeKey}
      onChange={({ activeKey }) => {
        setActiveKey(activeKey);
      }}
    >
      <Segment key="0" label="Contacts" badgeHint={true} />
      <Segment key="1" label="Messages" />
    </SegmentedControl>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PAGE
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function ButtonsSection() {
  return (
    <>
      <Section
        t="Button"
        n="Use it when a person submits a form or starts a new task."
      >
        <Grid>
          <Tile name="Basic usage" span={4}>
            <ButtonBasic />
          </Tile>
          <Tile
            name="Kinds"
            rule="primary · secondary · tertiary · dangerPrimary · dangerSecondary · dangerTertiary — the three danger kinds come out ink, because colour is not a status system here"
            span={8}
          >
            <ButtonKinds />
          </Tile>
          <Tile name="Sizes" rule="mini · default · compact · large · xSmall · small · medium" span={8}>
            <ButtonSizes />
          </Tile>
          <Tile name="With enhancers" rule="startEnhancer · endEnhancer" span={4}>
            <ButtonWithEnhancers />
          </Tile>
          <Tile name="States" rule="default · isLoading · isSelected · disabled" span={6}>
            <ButtonStates />
          </Tile>
          <Tile name="Shapes" rule="rectangular · rounded · square · circle" span={6}>
            <ButtonShapes />
          </Tile>
          <Tile name="Dropdown" span={4}>
            <ButtonDropdown />
          </Tile>
          <Tile name="Button as an anchor" rule="$as='a'" span={4}>
            <ButtonAsAnAnchor />
          </Tile>
          <Tile name="Width types" rule="widthType: hug · fill" span={4}>
            <ButtonWidthTypes />
          </Tile>
          <Tile name="Background safe" rule="backgroundSafe: off · on" span={6}>
            <ButtonBackgroundSafe />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Button Group"
        n="Use it to hold a set of similar actions together, where one or several of them may be selected."
      >
        <Grid>
          <Tile name="Basic usage" span={4}>
            <GroupBasic />
          </Tile>
          <Tile name="With icons" span={4}>
            <GroupIcon />
          </Tile>
          <Tile name="With enhancers" span={4}>
            <GroupEnhancer />
          </Tile>
          <Tile name="Radio mode" rule="mode=radio — one at a time" span={4}>
            <GroupRadioMode />
          </Tile>
          <Tile name="Checkbox mode" rule="mode=checkbox — several at a time" span={4}>
            <GroupCheckboxMode />
          </Tile>
          <Tile name="Disabled group" span={4}>
            <GroupDisabled />
          </Tile>
          <Tile name="Disabled button" span={4}>
            <GroupDisabledButton />
          </Tile>
          <Tile name="Dropdown" span={4}>
            <GroupDropdown />
          </Tile>
          <Tile name="Stateful radio" span={4}>
            <GroupStatefulRadio />
          </Tile>
          <Tile name="Stateful checkbox" span={4}>
            <GroupStatefulCheckbox />
          </Tile>
          <Tile name="Wrappable" rule="wrap — five buttons in a 200px box" span={4}>
            <GroupWrappable />
          </Tile>
          <Tile name="Scrollable" rule="wrap={false} — the same five, scrolling" span={4}>
            <GroupScrollable />
          </Tile>
          <Tile name="Padding" rule="PADDING.default · none · custom" span={6}>
            <GroupPadding />
          </Tile>
          <Tile
            name="Controlled"
            rule="in the examples folder, absent from the docs page — it ships"
            span={6}
          >
            <GroupControlled />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Button Timed"
        n="Use it sparingly, on a primary action that can confirm itself after a few seconds — an offer, or a decision that carries little weight."
      >
        <Grid>
          <Tile
            name="Deferred initialization"
            rule="pause starts and stops the countdown; initialTime is 10, 18, 35 and 60 seconds"
            span={6}
          >
            <TimedPaused />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Button Dock"
        n="Use it to keep one or more buttons on screen at all times, so a person can act at any moment rather than scrolling to the end of the page."
      >
        <Grid>
          <Tile
            name="Basic"
            rule="up to 4 buttons and one accessory; the wide variant renders above 600px"
            span={6}
          >
            <DockBasic />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Sliding Button"
        n="Use it when the action is costly or hard to undo, and a deliberate drag should stand in for a tap."
      >
        <Grid>
          <Tile
            name="Basic usage"
            rule="vendored from Uber's source — baseui@16.1.1 ships no sliding-button module"
            span={6}
          >
            <SlidingBasic />
          </Tile>
          <Tile name="States (default, loading, disabled)" span={6}>
            <SlidingStates />
          </Tile>
          <Tile
            name="Low threshold (20% drag)"
            rule="THRESHOLD.low, sliding back after 1500ms"
            span={6}
          >
            <SlidingLowThreshold />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Segmented Control"
        n="Use it for a single choice among up to five closely related options — a filter, or a change of view."
      >
        <Grid>
          <Tile name="Basic usage" span={6}>
            <SegmentedBasic />
          </Tile>
          <Tile name="Disabled segmented-control" span={6}>
            <SegmentedDisabled />
          </Tile>
          <Tile name="Badge" span={4}>
            <SegmentedBadge />
          </Tile>
          <Tile name="Badge hint" span={4}>
            <SegmentedBadgeHint />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
