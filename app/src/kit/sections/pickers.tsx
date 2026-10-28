/* PICKERS — Base Web's option-choosing controls, demonstrated by Base's own docs examples.
 *
 * Seven components, in order: Select, Combobox, Menu, Phone Input, Pin Code, Payment Card,
 * Rating. Every example file under bw-docs/examples/{select,combobox,menu,phone-input,pin-code,
 * payment-card,rating} ships here as one Tile, in the order its docs page lists them, with any
 * example file the page never renders appended at the end of its Section (select/overridden-tag,
 * pin-code/override).
 *
 * Every visible string is Uber's own, verbatim. This kit is GRAMMAR, not sentences: a themed demo
 * would pre-decide which control serves which moment of the product, and that decision belongs to
 * the situations catalogue, later and explicitly.
 *
 * The edits to Uber's code are four, and only four:
 *   (a) docs-site-local imports and the docs' own page chrome -> this page's chrome;
 *   (b) collision-free component names, since every example is a hook-carrying component and
 *       they all render on one page;
 *   (c) type repairs against the shipped baseui version;
 *   (d) the colour list twenty of these examples each re-declare is declared once — see COLOUR.
 *
 * COLOUR. Base's select/combobox/menu examples are all built on a list of CSS colour names, and
 * three of them paint a swatch from the option's own hex — a value outside the theme's reach.
 * ↯ Wherever a swatch is the demonstration (select "custom labels", combobox "custom option
 * node") the option carries a token off Base's own mono ramp and the swatch resolves it from the
 * theme. The demonstration — a custom node in an option row — is intact; the value comes off the
 * theme rather than out of the option. Two examples whose whole point is an override of a colour
 * (select/overridden-tag: slateblue/mediumpurple/lavender; pin-code/override: lightgreen/
 * seagreen) keep the override structure Uber wrote and take their values from the theme instead
 * of literals. Where an example demonstrates a STATE — pin-code `error`, pin-code `positive` —
 * the prop stays exactly as Uber wrote it: the Rocoto theme collapses negative/warning/positive
 * onto ink, so the demonstration is the theme working.
 *
 * IMAGES. menu/profile loads its avatar from via.placeholder.com, a host that no longer answers.
 * The same 60×60 slot is drawn locally as a neutral placeholder, inline as a data URI.
 *
 * TWO PACKAGES the docs list as extras for a single example each: react-window (select "with many
 * options") and react-virtualized (menu "with long items list"). Both are installed. Neither ships
 * type declarations, hence the two suppressions on their imports.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { styled, withStyle, useStyletron } from 'baseui';

import { Select, StatefulSelect, StyledDropdownListItem, TYPE } from 'baseui/select';
import type { Option, Value, ImperativeMethods } from 'baseui/select';
import {
  Menu,
  StatefulMenu,
  NestedMenus,
  OptionList,
  OptionProfile,
  StyledEmptyState,
  StyledList,
} from 'baseui/menu';
import type { OptionListProps } from 'baseui/menu';
import { Combobox } from 'baseui/combobox';
import { FormControl } from 'baseui/form-control';
import { Button } from 'baseui/button';
import { Modal, ModalBody, ModalButton, ModalFooter, ModalHeader } from 'baseui/modal';
import { MaskedInput, SIZE } from 'baseui/input';
import { COUNTRIES, PhoneInput, StatefulPhoneInput, StyledFlag } from 'baseui/phone-input';
import { PinCode, StatefulPinCode } from 'baseui/pin-code';
import { PaymentCard, StatefulPaymentCard, valid } from 'baseui/payment-card';
import { EmoticonRating, StarRating } from 'baseui/rating';
import { expandBorderStyles } from 'baseui/styles';

// @ts-expect-error — react-window ships no type declarations. The docs list it as an additional
// package for the "Select with many options" example alone.
import { FixedSizeList } from 'react-window';
// @ts-expect-error — react-virtualized ships no type declarations. Listed by the docs as an
// additional package for the "Menu with long items list" example alone.
import { List, AutoSizer } from 'react-virtualized';

/* The tile lays its children out in a flex column aligned to the start, so a Select, a Combobox
 * or a Menu — all of which size to their content — would collapse to their placeholder width.
 * This gives the example the full tile to sit in, and touches no example's own code. */
function Fill({ children }: { children: React.ReactNode }) {
  const [css] = useStyletron();
  return <div className={css({ width: '100%' })}>{children}</div>;
}

/* Base's own mono ramp, used wherever an example's demonstration is a coloured swatch. */
type Shade = 'mono400' | 'mono500' | 'mono600' | 'mono700' | 'mono800' | 'mono900';

/* One step of the ramp per option, for the two examples whose demonstration is a swatch. */
const SWATCH_SHADES: Shade[] = ['mono900', 'mono800', 'mono700', 'mono600', 'mono500', 'mono400'];

/* ── UBER'S COLOUR LIST, DECLARED ONCE ──────────────────────────────────────────────────────
 * Base's select, combobox and menu examples all pick from CSS colour names paired with their
 * hex, and the docs write that list out afresh in twenty files. It lives here once, and each
 * example projects it into the shape its own docs file used — so every line a reader compares
 * against the docs (`labelKey`, `valueKey`, `mapOptionToString`, `getItemLabel`, the grouping)
 * is still Uber's, and a hundred and fifty duplicated rows of sample data are gone.
 *
 * ↯ THESE HEXES ARE DATA, NOT PAINT — which is why the rows below carry the gate's marker and
 * nothing else in this file does. What an option row shows is the NAME; the hex only ever
 * travels as that option's identity, through Select's `valueKey="color"` or the combobox
 * option's `id`, and no style rule in this file reads one. The two examples that DO paint a
 * swatch — select/label, combobox/replacement-node — carry a token off Base's mono ramp and
 * resolve it from the theme instead. So a re-theme moves every colour a person can see, and
 * has nothing to move here.
 *
 * Uber's three copies of this list disagree with each other where nothing can observe it: the
 * two combobox copies drop the `#` on all but their first six ids, and select/async-options
 * carries a typo in its last one. The hash is normalised here; the typo is kept where it lives.
 */
const COLOR_LIST: Array<[string, string]> = [
  ['AliceBlue', '#F0F8FF'], ['AntiqueWhite', '#FAEBD7'], ['Aqua', '#00FFFF'], // theme-gate-allow: option data, never painted
  ['Aquamarine', '#7FFFD4'], ['Azure', '#F0FFFF'], ['Beige', '#F5F5DC'], // theme-gate-allow: option data, never painted
  ['IndianRed', '#CD5C5C'], ['LightCoral', '#F08080'], ['Salmon', '#FA8072'], // theme-gate-allow: option data, never painted
  ['DarkSalmon', '#E9967A'], ['LightSalmon', '#FFA07A'], ['Crimson', '#DC143C'], // theme-gate-allow: option data, never painted
  ['Red', '#FF0000'], ['FireBrick', '#B22222'], ['DarkRed', '#8B0000'], // theme-gate-allow: option data, never painted
  ['Pink', '#FFC0CB'], ['LightPink', '#FFB6C1'], ['HotPink', '#FF69B4'], // theme-gate-allow: option data, never painted
  ['DeepPink', '#FF1493'], ['MediumVioletRed', '#C71585'], ['PaleVioletRed', '#DB7093'], // theme-gate-allow: option data, never painted
  ['Coral', '#FF7F50'], ['Tomato', '#FF6347'], ['OrangeRed', '#FF4500'], // theme-gate-allow: option data, never painted
  ['DarkOrange', '#FF8C00'], ['Orange', '#FFA500'], ['Gold', '#FFD700'], // theme-gate-allow: option data, never painted
  ['Yellow', '#FFFF00'], ['LightYellow', '#FFFFE0'], ['LemonChiffon', '#FFFACD'], // theme-gate-allow: option data, never painted
  ['LightGoldenrodYellow', '#FAFAD2'], ['PapayaWhip', '#FFEFD5'], ['Moccasin', '#FFE4B5'], // theme-gate-allow: option data, never painted
  ['PeachPuff', '#FFDAB9'], ['PaleGoldenrod', '#EEE8AA'], ['Khaki', '#F0E68C'], // theme-gate-allow: option data, never painted
  ['DarkKhaki', '#BDB76B'], ['Lavender', '#E6E6FA'], ['Thistle', '#D8BFD8'], // theme-gate-allow: option data, never painted
  ['Plum', '#DDA0DD'], ['Violet', '#EE82EE'], ['Orchid', '#DA70D6'], // theme-gate-allow: option data, never painted
  ['Fuchsia', '#FF00FF'], ['Magenta', '#FF00FF'], ['MediumOrchid', '#BA55D3'], // theme-gate-allow: option data, never painted
  ['MediumPurple', '#9370DB'], ['Amethyst', '#9966CC'], ['BlueViolet', '#8A2BE2'], // theme-gate-allow: option data, never painted
  ['DarkViolet', '#9400D3'], ['DarkOrchid', '#9932CC'], ['DarkMagenta', '#8B008B'], // theme-gate-allow: option data, never painted
  ['Purple', '#800080'], ['Indigo', '#4B0082'], ['SlateBlue', '#6A5ACD'], // theme-gate-allow: option data, never painted
  ['DarkSlateBlue', '#483D8B'], ['MediumSlateBlue', '#7B68EE'], // theme-gate-allow: option data, never painted
];

/* Select and Menu read the list as `{id, color}`: the id is what the row shows, the colour is
 * the option's value. The list is kept both as a prefix and by name, because the two grouped
 * examples pick individual colours out of it rather than taking the first six. */
type ColorOption = { id: string; color: string };

const COLOR_BY_NAME: Record<string, ColorOption> = {};
for (const [id, color] of COLOR_LIST) COLOR_BY_NAME[id] = { id, color };

/* Black is the one colour the grouped examples add that the list above does not carry. */
COLOR_BY_NAME.Black = { id: 'Black', color: '#000000' }; // theme-gate-allow: option data, never painted

/* The six every short select / combobox / menu example picks from. */
const COLOR_OPTIONS: ColorOption[] = COLOR_LIST.slice(0, 6).map(([id, color]) => ({ id, color }));

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SELECT — nineteen examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* select/controlled.tsx */
function SelectControlledExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={COLOR_OPTIONS}
      labelKey="id"
      valueKey="color"
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/search-single-pick.tsx */
function SelectSearchSinglePickExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={COLOR_OPTIONS}
      labelKey="id"
      valueKey="color"
      placeholder="Choose a color"
      maxDropdownHeight="300px"
      type={TYPE.search}
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/label.tsx — ↯ Uber's swatch is the option's own hex; here it is a token off Base's mono
 * ramp, resolved from the theme. The demonstration (a node instead of a string, for both the
 * option row and the selected value) is unchanged. */
const SelectSwatch = styled<'div', { $shade: Shade }>('div', (props) => {
  return {
    width: props.$theme.sizing.scale300,
    height: props.$theme.sizing.scale300,
    marginRight: props.$theme.sizing.scale200,
    display: 'inline-block',
    backgroundColor: props.$theme.colors[props.$shade],
    verticalAlign: 'baseline',
    ...expandBorderStyles(props.$theme.borders.border400),
  };
});

const getSelectColorLabel = ({ option }: any) => {
  return (
    <React.Fragment>
      <SelectSwatch $shade={option.shade} />
      {option.id}
    </React.Fragment>
  );
};

const SELECT_SWATCH_OPTIONS = COLOR_LIST.slice(0, 6).map(([id], index) => ({
  id,
  shade: SWATCH_SHADES[index],
}));

function SelectCustomLabelExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={SELECT_SWATCH_OPTIONS}
      labelKey="id"
      valueKey="shade"
      onChange={(options) => setValue(options.value)}
      value={value}
      getOptionLabel={getSelectColorLabel}
      getValueLabel={getSelectColorLabel}
    />
  );
}

/* select/creatable.tsx */
function SelectCreatableExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      creatable
      options={[
        { id: 'Portland', label: 'Portland' },
        { id: 'NYC', label: 'New York City' },
        { id: 'LosAngeles', label: 'Los Angeles' },
        { id: 'Boston', label: 'Boston' },
        { id: 'Atlanta', label: 'Atlanta' },
        { id: 'SanFrancisco', label: 'San Francisco' },
      ]}
      labelKey="label"
      valueKey="id"
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/search-multi-pick.tsx */
function SelectSearchMultiPickExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={COLOR_OPTIONS}
      labelKey="id"
      valueKey="color"
      placeholder="Choose a color"
      maxDropdownHeight="300px"
      type={TYPE.search}
      multi
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/creatable-multi.tsx */
function SelectCreatableMultiExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      creatable
      multi
      options={[
        { id: 'Portland', label: 'Portland' },
        { id: 'NYC', label: 'New York City' },
        { id: 'LosAngeles', label: 'Los Angeles' },
        { id: 'Boston', label: 'Boston' },
        { id: 'Atlanta', label: 'Atlanta' },
        { id: 'SanFrancisco', label: 'San Francisco' },
      ]}
      labelKey="label"
      valueKey="id"
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/sizes.tsx */
function SelectSizesExample() {
  return (
    <React.Fragment>
      <StatefulSelect
        size={SIZE.compact}
        options={COLOR_OPTIONS}
        labelKey="id"
        valueKey="color"
        onChange={(event) => console.log(event)}
      />
      <br />
      <StatefulSelect
        options={COLOR_OPTIONS}
        labelKey="id"
        valueKey="color"
        onChange={(event) => console.log(event)}
      />
      <br />
      <StatefulSelect
        size={SIZE.large}
        options={COLOR_OPTIONS}
        labelKey="id"
        valueKey="color"
        onChange={(event) => console.log(event)}
      />
    </React.Fragment>
  );
}

/* select/grouped.tsx */
const SELECT_GROUPED_OPTIONS = {
  __ungrouped: [COLOR_BY_NAME.Black],
  Blueish: [COLOR_BY_NAME.AliceBlue, COLOR_BY_NAME.Aqua, COLOR_BY_NAME.Aquamarine],
  Whiteish: [COLOR_BY_NAME.AntiqueWhite, COLOR_BY_NAME.Azure, COLOR_BY_NAME.Beige],
};

function SelectGroupedExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={SELECT_GROUPED_OPTIONS}
      labelKey="id"
      valueKey="color"
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/native.tsx */
function SelectNativeExample() {
  const [value, setValue] = React.useState<any>([]);
  return (
    <Select
      options={COLOR_OPTIONS}
      labelKey="id"
      valueKey="color"
      searchable={false}
      clearable={false}
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/focus.tsx */
function SelectFocusExample() {
  const [css, theme] = useStyletron();
  const [value, setValue] = React.useState<Value>([]);
  const controlRef = React.useRef<ImperativeMethods>(null);
  return (
    <div className={css({ display: 'flex' })}>
      <Select
        controlRef={controlRef}
        creatable
        options={[
          { id: 'Portland', label: 'Portland' },
          { id: 'NYC', label: 'New York City' },
          { id: 'LosAngeles', label: 'Los Angeles' },
          { id: 'Boston', label: 'Boston' },
          { id: 'Atlanta', label: 'Atlanta' },
          { id: 'SanFrancisco', label: 'San Francisco' },
        ]}
        labelKey="label"
        valueKey="id"
        onChange={({ value }) => setValue(value)}
        value={value}
        overrides={{
          Root: {
            style: {
              marginRight: theme.sizing.scale600,
            },
          },
        }}
      />
      <Button onClick={() => controlRef.current && controlRef.current.setInputFocus()}>
        Click to focus
      </Button>
    </div>
  );
}

/* select/control-ref-dropdown.tsx */
function SelectControlRefDropdownExample() {
  const [css] = useStyletron();
  const [value, setValue] = React.useState<Value>([]);
  const controlRef = React.useRef<ImperativeMethods>(null);
  return (
    <div>
      <div
        className={css({
          display: 'flex',
          justifyContent: 'space-between',
          marginBottom: '20px',
        })}
      >
        <Button
          onClick={() => {
            controlRef.current && controlRef.current.setDropdownOpen(true);
          }}
        >
          Open Dropdown
        </Button>
        <Button
          onClick={() => {
            controlRef.current && controlRef.current.setDropdownOpen(false);
          }}
        >
          Close Dropdown
        </Button>
      </div>

      <Select
        controlRef={controlRef}
        options={[
          { id: 'a', label: 'apple' },
          { id: 'b', label: 'banana' },
          { id: 'c', label: 'orange' },
        ]}
        value={value}
        onChange={({ value }) => setValue(value)}
        overrides={{
          ValueContainer: { props: { 'data-id': 'selected' } },
        }}
      />
    </div>
  );
}

/* select/control-ref-input-value.tsx */
function SelectControlRefInputValueExample() {
  const [css] = useStyletron();
  const [value, setValue] = React.useState<Value>([]);
  const controlRef = React.useRef<ImperativeMethods>(null);
  return (
    <div>
      <div
        className={css({
          marginBottom: '20px',
        })}
      >
        <Button
          onClick={() => controlRef.current && controlRef.current.setInputValue('orange')}
        >
          Set value to &quot;orange&quot;
        </Button>
      </div>

      <Select
        controlRef={controlRef}
        options={[
          { id: 'a', label: 'apple' },
          { id: 'b', label: 'banana' },
          { id: 'c', label: 'orange' },
        ]}
        value={value}
        onChange={({ value }) => setValue(value)}
        overrides={{
          ValueContainer: { props: { 'data-id': 'selected' } },
        }}
      />
    </div>
  );
}

/* select/uncontrolled.tsx */
function SelectUncontrolledExample() {
  return (
    <StatefulSelect
      options={COLOR_OPTIONS}
      labelKey="id"
      valueKey="color"
      onChange={(event) => console.log(event)}
    />
  );
}

/* select/with-many-options.tsx — ten thousand options, virtualized with react-window. */
const SELECT_LIST_ITEM_HEIGHT = 36;
const SELECT_EMPTY_LIST_HEIGHT = 72;
const SELECT_MAX_LIST_HEIGHT = 500;

const SelectListItem = withStyle(StyledDropdownListItem, {
  paddingTop: 0,
  paddingBottom: 0,
  display: 'flex',
  alignItems: 'center',
});

const SelectFixedSizeListItem = ({
  data,
  index,
  style,
}: {
  data: { props: OptionListProps }[];
  index: number;
  style: React.CSSProperties;
}) => {
  const { item, overrides, ...restChildProps } = data[index].props;
  return (
    <SelectListItem
      key={item.id}
      // @ts-ignore todo: is this working? to adjust styletron props if so
      style={{
        boxSizing: 'border-box',
        ...style,
      }}
      {...restChildProps}
    >
      {item.id}
    </SelectListItem>
  );
};

const SelectVirtualDropdown = React.forwardRef<HTMLUListElement, any>((props: any, ref) => {
  const children = React.Children.toArray(props.children);

  if (!children[0] || !(children[0] as any).props.item) {
    return (
      <StyledList $style={{ height: SELECT_EMPTY_LIST_HEIGHT + 'px' }} ref={ref}>
        <StyledEmptyState {...(children[0] as any).props} />
      </StyledList>
    );
  }

  const height = Math.min(SELECT_MAX_LIST_HEIGHT, children.length * SELECT_LIST_ITEM_HEIGHT);

  return (
    <StyledList ref={ref}>
      <FixedSizeList
        width="100%"
        height={height}
        itemCount={children.length}
        itemData={children}
        itemKey={(index: number, data: { props: OptionListProps }[]) => data[index].props.item.id}
        itemSize={SELECT_LIST_ITEM_HEIGHT}
      >
        {SelectFixedSizeListItem}
      </FixedSizeList>
    </StyledList>
  );
});

const selectManyOptions: Option[] = [];

for (let i = 0; i < 10000; i += 1) {
  selectManyOptions.push({
    id: i,
    label: '' + i,
  });
}

function SelectWithManyOptionsExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={selectManyOptions}
      labelKey="id"
      valueKey="label"
      overrides={{ Dropdown: { component: SelectVirtualDropdown } }}
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* select/async-options.tsx — Uber's own copy of the colour list; the last id is the typo they
 * ship (`"7B68E`), kept as written. */
const SELECT_ASYNC_OPTIONS = COLOR_LIST.map(([label, hex]) => ({
  label,
  id: label === 'MediumSlateBlue' ? '"7B68E' : hex,
}));

function selectDebounce(fn: any, delay: number) {
  let timeoutId: any;
  function debounced(...args: any) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(() => {
      fn(...args);
    }, delay);
  }
  return debounced;
}

function SelectAsyncOptionsExample() {
  const [value, setValue] = React.useState<any>([]);
  const [options, setOptions] = React.useState<any>(SELECT_ASYNC_OPTIONS);
  const [isLoading, setIsLoading] = React.useState(false);

  const handleInputChange = selectDebounce(function (term: string) {
    if (!term) {
      setOptions(SELECT_ASYNC_OPTIONS);
      return;
    }
    setIsLoading(true);
    setTimeout(() => {
      const nextOptions = SELECT_ASYNC_OPTIONS.filter((option) => {
        return option.label.toLowerCase().includes(term.toLowerCase());
      });
      setOptions(nextOptions);
      setIsLoading(false);
    }, 1000);
  }, 400);

  return (
    <Select
      isLoading={isLoading}
      options={options}
      onChange={({ value }) => setValue(value)}
      onInputChange={(event: React.SyntheticEvent) => {
        const target = event.target as HTMLInputElement;
        handleInputChange(target.value);
      }}
      value={value}
    />
  );
}

/* select/in-modal.tsx */
function SelectInModalExample() {
  const [isOpen, setIsOpen] = React.useState(false);
  return (
    <React.Fragment>
      <Button
        onClick={() => {
          setIsOpen(true);
        }}
      >
        Open Modal
      </Button>
      <Modal
        onClose={() => {
          setIsOpen(false);
        }}
        isOpen={isOpen}
      >
        <ModalHeader>Hello world</ModalHeader>
        <ModalBody>
          <StatefulSelect
            options={COLOR_OPTIONS}
            labelKey="id"
            valueKey="color"
            onChange={(event) => console.log(event)}
          />
        </ModalBody>
        <ModalFooter>
          <ModalButton
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Cancel
          </ModalButton>
          <ModalButton
            onClick={() => {
              setIsOpen(false);
            }}
          >
            Okay
          </ModalButton>
        </ModalFooter>
      </Modal>
    </React.Fragment>
  );
}

/* select/overridden.tsx */
function SelectOverriddenMenuExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={COLOR_OPTIONS}
      labelKey="id"
      valueKey="color"
      value={value}
      onChange={({ value }) => setValue(value)}
      overrides={{
        StatefulMenu: {
          props: {
            stateReducer: (type: any, next: any, prev: any) => {
              // eslint-disable-next-line no-console
              console.log(type, prev, next);
              return next;
            },
          },
        },
      }}
    />
  );
}

/* select/overridden-dropdown.tsx */
function SelectOverriddenDropdownExample() {
  const [value, setValue] = React.useState<Value>([]);
  return (
    <Select
      options={COLOR_OPTIONS}
      labelKey="id"
      valueKey="color"
      value={value}
      onChange={({ value }) => setValue(value)}
      overrides={{
        Popover: {
          props: {
            overrides: {
              Body: { style: { marginTop: '0', marginBottom: '0' } },
            },
          },
        },
      }}
    />
  );
}

/* select/overridden-tag.tsx — the docs page never renders this file, so it ships last.
 * ↯ Uber's four literals (slateblue, mediumpurple ×2, lavender) come off the theme here; the
 * nested-override shape they demonstrate is exactly as written. The two zero radii stay: a
 * squared-off tag is what the override demonstrates, and zero is a shape, not a brand value. */
function SelectOverriddenTagExample() {
  const [, theme] = useStyletron();
  const [value, setValue] = React.useState<Value>([{ label: 'Atlanta', id: 'ATL' }]);

  return (
    <Select
      overrides={{
        Tag: {
          props: {
            overrides: {
              Root: {
                style: {
                  borderRadius: '0px', // theme-gate-allow: squaring the tag off IS the override demonstrated; zero is not a brand radius
                  backgroundColor: theme.colors.backgroundInversePrimary,
                },
              },
              Action: {
                style: {
                  borderRadius: '0px', // theme-gate-allow: squaring the tag off IS the override demonstrated; zero is not a brand radius
                  ':hover': {
                    backgroundColor: theme.colors.contentSecondary,
                  },
                  ':focus': {
                    backgroundColor: theme.colors.contentSecondary,
                  },
                },
              },
              Text: {
                style: {
                  color: theme.colors.contentInversePrimary,
                },
              },
              ActionIcon: {
                props: {
                  color: theme.colors.contentInversePrimary,
                },
              },
            },
          },
        },
      }}
      multi
      type="search"
      options={[
        { label: 'Atlanta', id: 'ATL' },
        { label: 'Baltimore', id: 'BWI' },
        { label: 'Chicago', id: 'ORD' },
        { label: 'Denver', id: 'DEN' },
      ]}
      onChange={({ value }) => setValue(value)}
      value={value}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * COMBOBOX — five examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

type ComboboxOption = { label: string; id: string; shade?: Shade };

/* The combobox names the same two fields the other way round: the label is what the row shows,
 * the id is the option's identity. Four of the five examples take the whole list or its first
 * six; combobox/filtered-options and combobox/async-options ship the very same one. */
const COMBOBOX_COLOR_OPTIONS: ComboboxOption[] = COLOR_LIST.map(([label, id]) => ({ label, id }));
const COMBOBOX_SIX_OPTIONS: ComboboxOption[] = COMBOBOX_COLOR_OPTIONS.slice(0, 6);

/* combobox/filtered-options.tsx */
const COMBOBOX_FILTERED_OPTIONS: ComboboxOption[] = COMBOBOX_COLOR_OPTIONS;

function ComboboxFilteredOptionsExample() {
  const [css] = useStyletron();
  const [value, setValue] = React.useState('');

  function mapOptionToString(option: ComboboxOption): string {
    return option.label;
  }

  const filteredOptions = React.useMemo(() => {
    return COMBOBOX_FILTERED_OPTIONS.filter((option) => {
      const optionAsString = mapOptionToString(option);
      return optionAsString.toLowerCase().includes(value.toLowerCase());
    });
  }, [value]);

  return (
    <div className={css({ width: '375px' })}>
      <FormControl label="Color">
        <Combobox
          value={value}
          onChange={setValue}
          mapOptionToString={mapOptionToString}
          options={filteredOptions}
          name="filtered-options"
        />
      </FormControl>
    </div>
  );
}

/* combobox/async-options.tsx */
const COMBOBOX_ASYNC_OPTIONS: ComboboxOption[] = COMBOBOX_COLOR_OPTIONS;

function comboboxMapOptionToString(option: ComboboxOption): string {
  return option.label;
}

function comboboxFetchOptions(searchTerm: string, callback: any) {
  setTimeout(() => {
    const options = COMBOBOX_ASYNC_OPTIONS.filter((option) => {
      const optionAsString = comboboxMapOptionToString(option);
      return optionAsString.toLowerCase().includes(searchTerm.toLowerCase());
    });
    callback(options);
  }, 500);
}

function ComboboxAsyncOptionsExample() {
  const [css] = useStyletron();
  const [value, setValue] = React.useState('');
  const [options, setOptions] = React.useState<ComboboxOption[]>([]);

  async function handleChange(nextValue: string) {
    setValue(nextValue);
    comboboxFetchOptions(nextValue, setOptions);
  }

  return (
    <div className={css({ width: '375px' })}>
      <FormControl label="Color">
        <Combobox
          value={value}
          onChange={handleChange}
          mapOptionToString={comboboxMapOptionToString}
          options={options}
          name="async-options"
        />
      </FormControl>
    </div>
  );
}

/* combobox/replacement-node.tsx — ↯ same swap as the Select custom-label example: the swatch
 * takes a token off Base's mono ramp rather than a hex out of the option. */
const COMBOBOX_NODE_OPTIONS: ComboboxOption[] = COMBOBOX_SIX_OPTIONS.map((option, index) => ({
  ...option,
  shade: SWATCH_SHADES[index],
}));

function ComboboxReplacementNode({ option }: any) {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        height: '36px',
      })}
    >
      <div
        className={css({
          backgroundColor: theme.colors[option.shade as Shade],
          height: '12px',
          marginRight: '8px',
          width: '12px',
        })}
      />
      {option.label}
    </div>
  );
}

function ComboboxReplacementNodeExample() {
  const [css] = useStyletron();
  const [value, setValue] = React.useState('');
  return (
    <div className={css({ width: '375px' })}>
      <FormControl label="Color">
        <Combobox
          value={value}
          onChange={setValue}
          mapOptionToString={(o: ComboboxOption) => o.label}
          mapOptionToNode={ComboboxReplacementNode}
          name="replacement-node"
          options={COMBOBOX_NODE_OPTIONS}
        />
      </FormControl>
    </div>
  );
}

/* combobox/input-overrides.tsx */
const COMBOBOX_INPUT_OVERRIDE_OPTIONS: ComboboxOption[] = COMBOBOX_SIX_OPTIONS;

function ComboboxInputOverridesExample() {
  const [css] = useStyletron();
  const [value, setValue] = React.useState('');
  return (
    <div className={css({ width: '375px' })}>
      <FormControl label="Color">
        <Combobox
          value={value}
          onChange={setValue}
          mapOptionToString={(o: ComboboxOption) => o.label}
          options={COMBOBOX_INPUT_OVERRIDE_OPTIONS}
          name="input-overrides"
          overrides={{
            Input: {
              props: {
                placeholder: 'placeholder text',
              },
            },
          }}
        />
      </FormControl>
    </div>
  );
}

/* combobox/focus.tsx */
const COMBOBOX_FOCUS_OPTIONS: ComboboxOption[] = COMBOBOX_SIX_OPTIONS;

function ComboboxFocusExample() {
  const [css, theme] = useStyletron();
  const [value, setValue] = React.useState('');
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className={css({ display: 'flex', flexDirection: 'row' })}>
      <span>
        <FormControl label="Color">
          <Combobox
            value={value}
            onChange={setValue}
            mapOptionToString={(o: ComboboxOption) => o.label}
            options={COMBOBOX_FOCUS_OPTIONS}
            inputRef={inputRef}
            overrides={{
              Root: {
                style: {
                  width: '375px',
                  marginRight: theme.sizing.scale600,
                },
              },
            }}
          />
        </FormControl>
      </span>
      <Button
        onClick={() => {
          inputRef.current && inputRef.current.focus();
        }}
      >
        Click to focus
      </Button>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * MENU — ten examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* menu/basic.tsx */
const MENU_BASIC_ITEMS = [
  { label: 'Item One' },
  { label: 'Item Two' },
  { label: 'Item Three', disabled: true },
  { label: 'Item Four', disabled: true },
  { label: 'Item Five' },
  { label: 'Item Six' },
  { label: 'Item Seven' },
  { label: 'Item Eight' },
  { label: 'Item Nine' },
  { label: 'Item Ten' },
  { label: 'Item Eleven' },
  { label: 'Item Twelve' },
];

function MenuBasicExample() {
  return (
    <StatefulMenu
      items={MENU_BASIC_ITEMS}
      onItemSelect={console.log}
      overrides={{
        List: {
          style: {
            height: '250px',
            width: '350px',
          },
        },
        Option: {
          props: {
            getItemLabel: (item: { label: string }) => item.label,
          },
        },
      }}
    />
  );
}

/* menu/compact.tsx */
const MENU_COMPACT_ITEMS = [
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

function MenuCompactExample() {
  return (
    <StatefulMenu
      items={MENU_COMPACT_ITEMS}
      overrides={{
        List: {
          style: {
            width: '500px',
          },
        },
        Option: {
          props: {
            getItemLabel: (item: { label: string }) => item.label,
            size: 'compact',
          },
        },
      }}
    />
  );
}

/* menu/profile.tsx — Uber's example loads each avatar from via.placeholder.com/60x60, a host that
 * no longer answers. The same 60×60 slot is drawn here as an inline SVG placeholder so the
 * OptionProfile row demonstrates what it was built to demonstrate. ↯ Its ground, its ink and
 * its face all come from the theme, so the placeholder re-brands with everything else. */
interface MenuProfileItem {
  title: string;
  subtitle: string;
  body: string;
  imgUrl: string;
}

function menuPlaceholderImage(background: string, foreground: string, font: string) {
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" width="60" height="60">` +
    `<rect width="60" height="60" fill="${background}"/>` +
    `<text x="30" y="34" font-family='${font}' font-size="12" ` +
    `fill="${foreground}" text-anchor="middle">60x60</text></svg>`;
  return `data:image/svg+xml;utf8,${encodeURIComponent(svg)}`;
}

function MenuProfileExample() {
  const [, theme] = useStyletron();
  const imgUrl = menuPlaceholderImage(
    theme.colors.backgroundInversePrimary,
    theme.colors.contentInversePrimary,
    theme.typography.font100.fontFamily,
  );
  const items: MenuProfileItem[] = Array.from({ length: 4 }, () => ({
    title: 'David Smith',
    subtitle: 'Senior Engineering Manager',
    body: 'Uber Everything',
    imgUrl,
  }));
  return (
    <StatefulMenu
      items={items}
      overrides={{
        List: {
          style: {
            width: '350px',
          },
        },
        Option: {
          component: OptionProfile,
          props: {
            getProfileItemLabels: ({ title, subtitle, body }: MenuProfileItem) => ({
              title,
              subtitle,
              body,
            }),
            getProfileItemImg: (item: MenuProfileItem) => item.imgUrl,
            getProfileItemImgText: (item: MenuProfileItem) => item.title,
          },
        },
      }}
    />
  );
}

/* menu/stateless.tsx */
const MENU_STATELESS_ITEMS = [
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

function MenuStatelessExample() {
  return (
    <Menu
      items={MENU_STATELESS_ITEMS}
      rootRef={React.createRef()}
      overrides={{
        List: {
          style: {
            width: '200px',
          },
        },
        Option: {
          props: {
            getItemLabel: (item: { label: string }) => item.label,
          },
        },
      }}
    />
  );
}

/* menu/child.tsx */
const MENU_OPEN_RECENT = 'Open Recent ->';
const MENU_NEW_BREAKPOINT = 'New Breakpoint ->';
const MENU_FILE_ITEMS = [
  { label: 'New File' },
  { label: 'New Window' },
  { label: 'Open...' },
  { label: 'Open Workspace...' },
  { label: MENU_OPEN_RECENT },
  { label: 'Add Folder to Workspace...' },
  { label: 'Save' },
  { label: 'Save As...' },
  { label: 'Toggle Breakpoint' },
  { label: MENU_NEW_BREAKPOINT },
  { label: 'Close Folder' },
  { label: 'Close Window' },
];

const MENU_RECENT_FILES = [
  { label: 'Reopen Closed Editor' },
  { label: '~/workspace/baseui' },
  { label: '~/workspace/styletron' },
  { label: '~/workspace/my-project' },
  { label: 'More...' },
  { label: 'Clear Recently Opened' },
];

const MENU_BREAKPOINTS = [
  { label: 'Conditional Breakpoint...' },
  { label: 'Inline Breakpoint' },
  { label: 'Function Breakpoint...' },
  { label: 'Logpoint...' },
];

function MenuChildExample() {
  return (
    <NestedMenus>
      <StatefulMenu
        items={MENU_FILE_ITEMS}
        overrides={{
          List: { style: { width: '350px', overflow: 'auto' } },
          Option: {
            props: {
              size: 'compact',
              getChildMenu: (item: { label: string }) => {
                if (item.label === MENU_OPEN_RECENT) {
                  return (
                    // todo: removed size="compact"
                    <StatefulMenu
                      items={MENU_RECENT_FILES}
                      overrides={{
                        List: { style: { width: '200px' } },
                        Option: { props: { size: 'compact' } },
                      }}
                    />
                  );
                }

                if (item.label === MENU_NEW_BREAKPOINT) {
                  return (
                    <StatefulMenu
                      items={MENU_BREAKPOINTS}
                      overrides={{
                        List: { style: { width: '220px' } },
                        Option: { props: { size: 'compact' } },
                      }}
                    />
                  );
                }
                return null;
              },
            },
          },
        }}
      />
    </NestedMenus>
  );
}

/* menu/child-render-all.tsx — the second submenu still spells out the point of `renderAll`:
 * it is in the DOM before it is ever opened. */
const MENU_SSR = 'Rendered ->';
const MENU_SERVER = 'Server ->';
const MENU_RENDER_ALL_ITEMS = [
  { label: MENU_SERVER },
  { label: 'Side' },
  { label: 'Up' },
  { label: MENU_SSR },
];

const MENU_SERVER_SUB_MENU = [
  { label: 'DKR130' },
  { label: 'GKE135' },
  { label: 'FPF009' },
  { label: 'GKP399' },
  { label: 'GPO123' },
  { label: 'KKC453' },
  { label: 'ZPS118' },
];

const MENU_SSR_SUB_MENU = [
  { label: 'Rendered' },
  { label: 'SSR' },
  { label: '(check source!)' },
  { label: 'And' },
  { label: 'When' },
  { label: 'Closed' },
];

function MenuChildRenderAllExample() {
  return (
    <NestedMenus>
      <StatefulMenu
        items={MENU_RENDER_ALL_ITEMS}
        renderAll
        overrides={{
          List: { style: { width: '350px', overflow: 'auto' } },
          Option: {
            props: {
              size: 'compact',
              getChildMenu: (item: { label: string }) => {
                if (item.label === MENU_SSR) {
                  return (
                    <StatefulMenu
                      // @ts-ignore todo:
                      size="compact"
                      items={MENU_SSR_SUB_MENU}
                      overrides={{
                        List: { style: { width: '200px' } },
                        Option: { props: { size: 'compact' } },
                      }}
                    />
                  );
                }
                if (item.label === MENU_SERVER) {
                  return (
                    <StatefulMenu
                      // @ts-ignore todo:
                      size="compact"
                      items={MENU_SERVER_SUB_MENU}
                      overrides={{
                        List: { style: { width: '200px' } },
                        Option: { props: { size: 'compact' } },
                      }}
                    />
                  );
                }
                return undefined;
              },
            },
          },
        }}
      />
    </NestedMenus>
  );
}

/* menu/grouped.tsx */
const MENU_GROUPED_ITEMS = {
  __ungrouped: [COLOR_BY_NAME.Black],
  Blueish: [COLOR_BY_NAME.AliceBlue, COLOR_BY_NAME.Aqua, COLOR_BY_NAME.Aquamarine],
  Whiteish: [COLOR_BY_NAME.AntiqueWhite, COLOR_BY_NAME.Azure, COLOR_BY_NAME.Beige],
};

function MenuGroupedExample() {
  return (
    <StatefulMenu
      items={MENU_GROUPED_ITEMS}
      onItemSelect={({ item }) => console.log(item)}
      overrides={{
        List: {
          style: {
            width: '200px',
          },
        },
        Option: {
          props: {
            getItemLabel: (item: any) => item.id,
          },
        },
      }}
    />
  );
}

/* menu/virtual-list.tsx — 1500 items through react-virtualized. The Container carries a width so
 * AutoSizer has something to measure inside the tile. */
const MENU_VIRTUAL_ITEMS = Array.from({ length: 1500 }, (_, index) => ({
  label: `item number: ${index + 1}`,
}));

const MenuVirtualContainer = withStyle(StyledList, { height: '500px', width: '100%' });

const MenuVirtualList = React.forwardRef((props: any, ref) => {
  const children = React.Children.toArray(props.children);
  return (
    <MenuVirtualContainer {...props} ref={ref}>
      <AutoSizer>
        {({ width }: { width: number }) => (
          <List
            role={props.role}
            height={500}
            rowCount={props.children.length}
            rowHeight={36}
            rowRenderer={({ index, key, style }: any) => (
              <OptionList
                key={key}
                style={style}
                {...(children[index] as any).props}
                overrides={{
                  ListItem: {
                    style: {
                      paddingTop: 0,
                      paddingBottom: 0,
                      display: 'flex',
                      alignItems: 'center',
                    },
                  },
                }}
              />
            )}
            width={width}
          />
        )}
      </AutoSizer>
    </MenuVirtualContainer>
  );
});

function MenuVirtualListExample() {
  return (
    <StatefulMenu
      items={MENU_VIRTUAL_ITEMS}
      overrides={{ List: { component: MenuVirtualList } }}
    />
  );
}

/* menu/href.tsx */
function MenuHrefExample() {
  return (
    <StatefulMenu
      items={[
        { label: 'Apple', href: '//www.example.com/apple' },
        { label: 'Orange', href: '//www.example.com/orange' },
        { label: 'Strawberry', href: '//www.example.com/strawberry' },
      ]}
    />
  );
}

/* menu/dividers.tsx */
const MENU_DIVIDER_ITEMS = [
  { label: 'Menu option A' },
  { label: 'Menu option B' },
  { divider: true },
  { label: 'Menu option X' },
  { label: 'Menu option Y' },
  { label: 'Menu option Z' },
  { divider: true },
  { label: 'Menu option 1' },
  { label: 'Menu option 2' },
  { label: 'Menu option 3' },
];

function MenuDividersExample() {
  return (
    <StatefulMenu
      items={MENU_DIVIDER_ITEMS}
      onItemSelect={console.log}
      overrides={{
        List: {
          style: {
            height: '250px',
            width: '350px',
          },
        },
        Option: {
          props: {
            getItemLabel: (item: { label: string }) => item.label,
          },
        },
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * PHONE INPUT — five examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* phone-input/basic.tsx */
function PhoneInputBasicExample() {
  const [text, setText] = React.useState('');
  const [country, setCountry] = React.useState(COUNTRIES.US);
  return (
    <PhoneInput
      text={text}
      country={country}
      onTextChange={(event) => {
        setText(event.currentTarget.value);
      }}
      onCountryChange={(event: any) => {
        setCountry(event.option);
      }}
    />
  );
}

/* phone-input/localized.tsx */
const phoneIso2FlagEmoji = (iso: any) =>
  String.fromCodePoint(
    ...Array.from(iso.toUpperCase()).map((char: any) => char.charCodeAt(0) + 127397),
  );

function PhoneInputLocalizedExample() {
  const [text, setText] = React.useState('');
  const [country, setCountry] = React.useState(COUNTRIES.US);
  return (
    <PhoneInput
      text={text}
      country={country}
      onTextChange={(event) => {
        setText(event.currentTarget.value);
      }}
      onCountryChange={(event: any) => {
        setCountry(event.option);
      }}
      mapIsoToLabel={(iso) => phoneIso2FlagEmoji(iso)}
    />
  );
}

/* phone-input/flag-overrides.tsx */
function PhoneInputCustomFlag(props: any) {
  const { children, ...rest } = props;
  return <StyledFlag iso={props.$iso} {...rest} />;
}

function PhoneInputFlagOverridesExample() {
  const [text, setText] = React.useState('');
  const [country, setCountry] = React.useState(COUNTRIES.US);
  return (
    <PhoneInput
      text={text}
      country={country}
      onTextChange={(event) => {
        setText(event.currentTarget.value);
      }}
      onCountryChange={(event: any) => {
        setCountry(event.option);
      }}
      overrides={{
        FlagContainer: {
          component: PhoneInputCustomFlag,
        },
      }}
    />
  );
}

/* phone-input/nested-overrides.tsx */
function PhoneInputNestedOverridesExample() {
  const [text, setText] = React.useState('');
  const [country, setCountry] = React.useState(COUNTRIES.US);
  return (
    <PhoneInput
      text={text}
      country={country}
      onTextChange={(event) => {
        setText(event.currentTarget.value);
      }}
      onCountryChange={(event: any) => {
        setCountry(event.option);
      }}
      overrides={{
        Input: {
          props: {
            overrides: {
              Root: {
                style: {
                  width: '300px',
                },
              },
            },
          },
        },
      }}
    />
  );
}

/* phone-input/uncontrolled.tsx */
function PhoneInputUncontrolledExample() {
  return <StatefulPhoneInput />;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * PIN CODE — thirteen examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* pin-code/basic.tsx */
function PinCodeBasicExample() {
  const [values, setValues] = React.useState(['', '', '', '']);
  return (
    <PinCode
      values={values}
      onChange={({ values }) => {
        setValues(values);
      }}
    />
  );
}

/* pin-code/length.tsx */
function PinCodeLengthExample() {
  const [values, setValues] = React.useState(Array(10).fill(''));
  return (
    <PinCode
      values={values}
      onChange={({ values }) => {
        setValues(values);
      }}
    />
  );
}

/* pin-code/id-and-name.tsx */
function PinCodeIdAndNameExample() {
  const [values, setValues] = React.useState(['', '', '', '']);
  return (
    <PinCode
      id="foo"
      name="pin-code"
      values={values}
      onChange={({ values }) => {
        setValues(values);
      }}
    />
  );
}

/* pin-code/states.tsx — `error` and `positive` stay exactly as Uber wrote them; the theme
 * collapses both onto ink, which is the demonstration. */
function PinCodeStatesExample() {
  const [valuesA, setValuesA] = React.useState(['', '', '', '']);
  const [valuesB, setValuesB] = React.useState(['', '', '', '']);
  const [valuesC, setValuesC] = React.useState(['', '', '', '']);
  return (
    <React.Fragment>
      <PinCode
        disabled
        values={valuesA}
        onChange={({ values }) => {
          setValuesA(values);
        }}
      />
      <br />
      <PinCode
        error
        values={valuesB}
        onChange={({ values }) => {
          setValuesB(values);
        }}
      />
      <br />
      <PinCode
        positive
        values={valuesC}
        onChange={({ values }) => {
          setValuesC(values);
        }}
      />
    </React.Fragment>
  );
}

/* pin-code/size.tsx */
function PinCodeSizesExample() {
  const [valuesA, setValuesA] = React.useState(['', '', '', '']);
  const [valuesB, setValuesB] = React.useState(['', '', '', '']);
  const [valuesC, setValuesC] = React.useState(['', '', '', '']);
  return (
    <React.Fragment>
      <PinCode
        size={SIZE.compact}
        values={valuesA}
        onChange={({ values }) => {
          setValuesA(values);
        }}
      />
      <br />
      <PinCode
        values={valuesB}
        onChange={({ values }) => {
          setValuesB(values);
        }}
      />
      <br />
      <PinCode
        size={SIZE.large}
        values={valuesC}
        onChange={({ values }) => {
          setValuesC(values);
        }}
      />
    </React.Fragment>
  );
}

/* pin-code/placeholder.tsx */
function PinCodePlaceholderExample() {
  const [values, setValues] = React.useState(['', '', '', '']);
  return (
    <PinCode
      placeholder="😀"
      values={values}
      onChange={({ values }) => {
        setValues(values);
      }}
    />
  );
}

/* pin-code/mask.tsx */
function PinCodeMaskExample() {
  const [valuesA, setValuesA] = React.useState(['', '', '', '']);
  const [valuesB, setValuesB] = React.useState(['', '', '', '']);

  return (
    <React.Fragment>
      <PinCode
        mask
        values={valuesA}
        onChange={({ values }) => {
          setValuesA(values);
        }}
      />
      <br />
      <PinCode
        mask="*"
        values={valuesB}
        onChange={({ values }) => {
          setValuesB(values);
        }}
      />
    </React.Fragment>
  );
}

/* pin-code/no-tab.tsx */
function PinCodeNoTabExample() {
  const [values, setValues] = React.useState(['', '', '', '']);
  return (
    <React.Fragment>
      <PinCode
        manageFocus={false}
        values={values}
        onChange={({ values }) => {
          setValues(values);
        }}
      />
    </React.Fragment>
  );
}

/* pin-code/event.tsx */
function PinCodeEventExample() {
  const [values, setValues] = React.useState(['', '', '', '']);
  return (
    <PinCode
      values={values}
      manageFocus={false}
      onChange={({ values, event }) => {
        setValues(values);
        alert(event.target);
      }}
    />
  );
}

/* pin-code/autofocus.tsx */
function PinCodeAutofocusExample() {
  const [css, theme] = useStyletron();
  const [showPinCode, toggle] = React.useState(false);
  const [values, setValues] = React.useState(['', '', '', '']);
  return (
    <div className={css({ display: 'flex' })}>
      <Button onClick={() => toggle((s) => !s)}>Mount PinCode</Button>
      <div className={css({ marginLeft: theme.sizing.scale300 })} />
      {showPinCode ? (
        <PinCode
          values={values}
          onChange={({ values }) => {
            setValues(values);
          }}
          autoFocus
        />
      ) : null}
    </div>
  );
}

/* pin-code/completion.tsx */
function PinCodeCompletionExample() {
  const [css] = useStyletron();
  const [values, setValues] = React.useState(['', '', '', '']);
  const buttonRef = React.useRef<HTMLButtonElement>(null);
  return (
    <div className={css({ display: 'flex' })}>
      <PinCode
        values={values}
        onChange={({ values }: any) => {
          setValues(values);
          // if all of our inputs are filled in,
          // shift focus to our submit button
          if (!values.includes('')) {
            buttonRef.current && buttonRef.current.focus();
          }
        }}
      />
      <Button ref={buttonRef}>Submit</Button>
    </div>
  );
}

/* pin-code/stateful.tsx */
function PinCodeStatefulExample() {
  return (
    <StatefulPinCode initialState={{ values: ['', '', '', ''] }} onChange={console.log} />
  );
}

/* pin-code/override.tsx — the docs page never renders this file, so it ships last. ↯ Uber's five
 * literals (lightgreen, seagreen ×4) come off the theme here; the nested-override shape and the
 * longhand-property note they demonstrate are exactly as written. */
function PinCodeOverrideExample() {
  const [, theme] = useStyletron();
  const [values, setValues] = React.useState(['', '', '', '']);
  const overrides = {
    Input: {
      props: {
        overrides: {
          InputContainer: {
            style: {
              // use longhand CSS properties
              backgroundColor: theme.colors.backgroundSecondary,
              borderLeftColor: theme.colors.borderSelected,
              borderRightColor: theme.colors.borderSelected,
              borderTopColor: theme.colors.borderSelected,
              borderBottomColor: theme.colors.borderSelected,
            },
          },
        },
      },
    },
  };
  return (
    <PinCode
      overrides={overrides}
      values={values}
      onChange={({ values }) => {
        setValues(values);
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * PAYMENT CARD — four examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* payment-card/controlled.tsx */
function PaymentCardControlledExample() {
  const [value, setValue] = React.useState('');
  return (
    <PaymentCard
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
      placeholder="Please enter your credit card number..."
    />
  );
}

/* payment-card/defaultvalue.tsx */
function PaymentCardDefaultValueExample() {
  const [value, setValue] = React.useState('4111111111111111');
  return (
    <PaymentCard
      onChange={(event) => setValue((event.target as HTMLInputElement).value)}
      placeholder="Please enter your credit card number..."
      value={value}
    />
  );
}

/* payment-card/form.tsx */
function getPaymentFormOverrides(width: string) {
  return {
    ControlContainer: {
      style: {
        width,
        margin: '5px',
      },
    },
  };
}

function PaymentCardFormExample() {
  const [number, setNumber] = React.useState('');
  const [expiration, setExpiration] = React.useState('');
  const [code, setCode] = React.useState('');
  const [css] = useStyletron();

  const { card } = valid.number(number);
  let codeLength;

  if (card && card.code && card.code.size) {
    codeLength = card.code.size;
  }

  return (
    <div className={css({ display: 'flex' })}>
      <FormControl overrides={getPaymentFormOverrides('250px')} caption="Card number">
        <PaymentCard
          value={number}
          onChange={(event) => setNumber(event.currentTarget.value)}
          placeholder="Card number"
        />
      </FormControl>
      <FormControl overrides={getPaymentFormOverrides('90px')} caption="Expiration date">
        <MaskedInput
          value={expiration}
          onChange={(event) => setExpiration(event.currentTarget.value)}
          placeholder="MM/YY"
          mask="99/99"
        />
      </FormControl>
      <FormControl overrides={getPaymentFormOverrides('70px')} caption="CVC">
        <MaskedInput
          value={code}
          onChange={(event) => setCode(event.currentTarget.value)}
          placeholder="CVC"
          mask={codeLength ? '9'.repeat(codeLength) : '999'}
        />
      </FormControl>
    </div>
  );
}

/* payment-card/uncontrolled.tsx */
function PaymentCardUncontrolledExample() {
  return (
    <StatefulPaymentCard
      placeholder="Please enter your credit card number..."
      onChange={(event) => console.log((event.target as HTMLInputElement).value)}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * RATING — three examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* rating/star.tsx */
function RatingStarExample() {
  const [value, setValue] = React.useState(1);
  return <StarRating value={value} onChange={({ value }) => setValue(value)} />;
}

/* rating/starReadOnly.tsx */
function RatingStarReadOnlyExample() {
  const [value, setValue] = React.useState(3);
  return <StarRating value={value} onChange={({ value }) => setValue(value)} readOnly />;
}

/* rating/emoticon.tsx */
function RatingEmoticonExample() {
  const [value, setValue] = React.useState(1);
  return <EmoticonRating value={value} onChange={({ value }) => setValue(value)} />;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function PickersSection() {
  return (
    <>
      <Section
        t="Select"
        n="When a person picks one option, or several, out of a list the application supplies."
      >
        <Grid>
          <Tile
            name="Select basic usage"
            span={4}
            rule="The value is always an array, single-pick or multi, and setState takes the whole option object rather than its id."
          >
            <Fill>
              <SelectControlledExample />
            </Fill>
          </Tile>
          <Tile
            name="Select as single-pick search"
            span={4}
            rule="type=search puts a magnifying glass to the left of the input and drops the arrow on the right."
          >
            <Fill>
              <SelectSearchSinglePickExample />
            </Fill>
          </Tile>
          <Tile
            name="Select with custom labels"
            span={4}
            rule="getOptionLabel and getValueLabel take a node, so the row and the selected value carry more than a string."
          >
            <Fill>
              <SelectCustomLabelExample />
            </Fill>
          </Tile>
          <Tile
            name="Select creatable"
            span={4}
            rule="A person may add an option that was never on the list."
          >
            <Fill>
              <SelectCreatableExample />
            </Fill>
          </Tile>
          <Tile name="Select as multi-pick search" span={4}>
            <Fill>
              <SelectSearchMultiPickExample />
            </Fill>
          </Tile>
          <Tile name="Select creatable multi-pick" span={4}>
            <Fill>
              <SelectCreatableMultiExample />
            </Fill>
          </Tile>
          <Tile name="Select sizes" span={4}>
            <Fill>
              <SelectSizesExample />
            </Fill>
          </Tile>
          <Tile
            name="Select with grouped options"
            span={4}
            rule="Options arrive as an object of groups; the __ungrouped key sits above the first heading."
          >
            <Fill>
              <SelectGroupedExample />
            </Fill>
          </Tile>
          <Tile
            name="Select similar to native select"
            span={4}
            rule="searchable and clearable both off, so it behaves the way a browser's own select does."
          >
            <Fill>
              <SelectNativeExample />
            </Fill>
          </Tile>
          <Tile
            name="Imperatively control input focus"
            span={6}
            rule="controlRef exposes setInputFocus, setInputBlur, setDropdownOpen and setInputValue."
          >
            <Fill>
              <SelectFocusExample />
            </Fill>
          </Tile>
          <Tile name="Imperatively control dropdown" span={6}>
            <Fill>
              <SelectControlRefDropdownExample />
            </Fill>
          </Tile>
          <Tile name="Imperatively control input value" span={6}>
            <Fill>
              <SelectControlRefInputValueExample />
            </Fill>
          </Tile>
          <Tile name="Select uncontrolled example" span={6}>
            <Fill>
              <SelectUncontrolledExample />
            </Fill>
          </Tile>
          <Tile
            name="Select with many options"
            span={6}
            rule="Ten thousand options. The Dropdown override hands the list to react-window, so only the visible rows exist."
          >
            <Fill>
              <SelectWithManyOptionsExample />
            </Fill>
          </Tile>
          <Tile
            name="Select with async options"
            span={6}
            rule="onInputChange, debounced, refills the options while isLoading holds the spinner in the control."
          >
            <Fill>
              <SelectAsyncOptionsExample />
            </Fill>
          </Tile>
          <Tile
            name="Select in a modal dialog"
            span={6}
            rule="The dropdown's popover escapes the dialog's own layer without any configuration."
          >
            <Fill>
              <SelectInModalExample />
            </Fill>
          </Tile>
          <Tile
            name="Select with overridden menu"
            span={6}
            rule="A stateReducer passed through to the StatefulMenu the dropdown builds internally."
          >
            <Fill>
              <SelectOverriddenMenuExample />
            </Fill>
          </Tile>
          <Tile
            name="Select dropdown overrides"
            span={6}
            rule="Reaching the Popover inside the Dropdown takes a nested override — props.overrides, not style."
          >
            <Fill>
              <SelectOverriddenDropdownExample />
            </Fill>
          </Tile>
          <Tile
            name="Select with an overridden tag"
            span={6}
            rule="An example file the docs page never renders: the multi-pick Tag, restyled through two levels of override."
          >
            <Fill>
              <SelectOverriddenTagExample />
            </Fill>
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Combobox"
        n="When a person types into a field and a list suggests completions, including text that is not on the list."
      >
        <Grid>
          <Tile
            name="Filtered options"
            span={6}
            rule="The caller owns the filtering. Base renders whatever list it is handed."
          >
            <ComboboxFilteredOptionsExample />
          </Tile>
          <Tile
            name="Async options"
            span={6}
            rule="Suggestions fetched on every input change, the shape a remote source takes."
          >
            <ComboboxAsyncOptionsExample />
          </Tile>
          <Tile
            name="Custom option node"
            span={6}
            rule="mapOptionToNode draws the row; mapOptionToString still supplies what lands in the input."
          >
            <ComboboxReplacementNodeExample />
          </Tile>
          <Tile
            name="Input props"
            span={6}
            rule="The Input override reaches the underlying field — here, its placeholder."
          >
            <ComboboxInputOverridesExample />
          </Tile>
          <Tile name="Focus and inputRef" span={12}>
            <ComboboxFocusExample />
          </Tile>
        </Grid>
      </Section>

      <Section t="Menu" n="When you want to display a navigational list, or a list of actions.">
        <Grid>
          <Tile name="Menu Basic Usage" span={6}>
            <Fill>
              <MenuBasicExample />
            </Fill>
          </Tile>
          <Tile name="Menu with Compact Menu Items" span={6}>
            <Fill>
              <MenuCompactExample />
            </Fill>
          </Tile>
          <Tile
            name="Menu with Profile Menu"
            span={6}
            rule="The Option key swaps OptionList for OptionProfile: image, title, subtitle and body in one row."
          >
            <Fill>
              <MenuProfileExample />
            </Fill>
          </Tile>
          <Tile
            name="Menu Stateless example"
            span={6}
            rule="The bare Menu keeps no state of its own, so highlight and selection belong to the caller."
          >
            <Fill>
              <MenuStatelessExample />
            </Fill>
          </Tile>
          <Tile
            name="Menu with Child Menu"
            span={6}
            rule="NestedMenus plus getChildMenu: a submenu opens beside the item that owns it."
          >
            <Fill>
              <MenuChildExample />
            </Fill>
          </Tile>
          <Tile
            name="Menu with Child Menu renderAll (SSR / SEO)"
            span={6}
            rule="renderAll puts every submenu in the markup before it is opened, so a crawler reads it."
          >
            <Fill>
              <MenuChildRenderAllExample />
            </Fill>
          </Tile>
          <Tile name="Menu with Grouped Items" span={6}>
            <Fill>
              <MenuGroupedExample />
            </Fill>
          </Tile>
          <Tile name="Menu with URL href" span={6}>
            <Fill>
              <MenuHrefExample />
            </Fill>
          </Tile>
          <Tile
            name="Menu with Long Items List"
            span={12}
            rule="Fifteen hundred items behind a List override, virtualized with react-virtualized."
          >
            <Fill>
              <MenuVirtualListExample />
            </Fill>
          </Tile>
          <Tile
            name="Menu with Dividers"
            span={6}
            rule="An item of {divider: true} draws a rule and takes itself out of the keyboard order."
          >
            <Fill>
              <MenuDividersExample />
            </Fill>
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Phone Input"
        n="When a person gives a phone number together with the dial code of its country."
      >
        <Grid>
          <Tile name="Basic usage" span={4}>
            <Fill>
              <PhoneInputBasicExample />
            </Fill>
          </Tile>
          <Tile
            name="Localized country names"
            span={4}
            rule="mapIsoToLabel rewrites what the country picker shows — here, the flag emoji for each ISO code."
          >
            <Fill>
              <PhoneInputLocalizedExample />
            </Fill>
          </Tile>
          <Tile
            name="With flag overrides and virtualized dropdown list"
            span={4}
            rule="The FlagContainer override replaces the flag; the country list stays virtualized underneath."
          >
            <Fill>
              <PhoneInputFlagOverridesExample />
            </Fill>
          </Tile>
          <Tile
            name="With nested overrides"
            span={4}
            rule="Reaching the Input's own Root takes props.overrides, one level down."
          >
            <Fill>
              <PhoneInputNestedOverridesExample />
            </Fill>
          </Tile>
          <Tile name="Stateful (uncontrolled) usage" span={4}>
            <Fill>
              <PhoneInputUncontrolledExample />
            </Fill>
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Pin Code"
        n="When a person enters a short sequence of digits, most often a single-use code."
      >
        <Grid>
          <Tile
            name="Basic usage"
            span={4}
            rule="One digit per input. Focus moves on as each digit lands, and Delete on an empty input clears the one before it."
          >
            <PinCodeBasicExample />
          </Tile>
          <Tile
            name="Code length"
            span={6}
            rule="The number of inputs is the length of the values array."
          >
            <PinCodeLengthExample />
          </Tile>
          <Tile
            name="Passing id and name"
            span={4}
            rule="name is shared by every input; id gains an index, so foo becomes foo-0 through foo-3."
          >
            <PinCodeIdAndNameExample />
          </Tile>
          <Tile
            name="States"
            span={4}
            rule="disabled, error and positive, as Uber wrote them. Ink answers all three here."
          >
            <PinCodeStatesExample />
          </Tile>
          <Tile name="Sizes" span={4}>
            <PinCodeSizesExample />
          </Tile>
          <Tile
            name="Changing the placeholder"
            span={4}
            rule="The default placeholder is ○; each one disappears while any input holds focus."
          >
            <PinCodePlaceholderExample />
          </Tile>
          <Tile
            name="Adding mask"
            span={4}
            rule="mask alone gives a dot; mask takes a string for any other character."
          >
            <PinCodeMaskExample />
          </Tile>
          <Tile
            name="Disable focus management"
            span={4}
            rule="manageFocus off hands the focus logic back to the caller."
          >
            <PinCodeNoTabExample />
          </Tile>
          <Tile
            name="The main Event"
            span={4}
            rule="onChange carries the original input event alongside the values it suggests."
          >
            <PinCodeEventExample />
          </Tile>
          <Tile name="Autofocus" span={6}>
            <PinCodeAutofocusExample />
          </Tile>
          <Tile
            name="Once things are filled in"
            span={6}
            rule="A full code moves the focus straight to the button that submits it."
          >
            <PinCodeCompletionExample />
          </Tile>
          <Tile name="Stateful (uncontrolled) usage" span={4}>
            <PinCodeStatefulExample />
          </Tile>
          <Tile
            name="Overriding the input"
            span={4}
            rule="An example file the docs page never renders: each box restyled through the Input's own overrides, in longhand properties."
          >
            <PinCodeOverrideExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Payment Card"
        n="When a person enters a card number and the field should detect and format the brand as they type."
      >
        <Grid>
          <Tile
            name="Basic usage"
            span={4}
            rule="Uber deprecated this component in October 2024: it reads raw cardholder data, which PCI DSS v4 puts behind an isolated frame."
          >
            <Fill>
              <PaymentCardControlledExample />
            </Fill>
          </Tile>
          <Tile name="Default value" span={4}>
            <Fill>
              <PaymentCardDefaultValueExample />
            </Fill>
          </Tile>
          <Tile
            name="Payment form"
            span={12}
            rule="card-validator, re-exported as valid, reports the brand — and the brand sets how many digits the CVC mask accepts."
          >
            <Fill>
              <PaymentCardFormExample />
            </Fill>
          </Tile>
          <Tile name="Stateful (uncontrolled) usage" span={4}>
            <Fill>
              <PaymentCardUncontrolledExample />
            </Fill>
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Rating"
        n="When a person scores something out of five — stars for a product, emoticons for how the experience felt."
      >
        <Grid>
          <Tile name="Rating with stars" span={4}>
            <RatingStarExample />
          </Tile>
          <Tile
            name="Rating with stars read only"
            span={4}
            rule="readOnly reports a score already given; the group keeps its radiogroup semantics and marks itself aria-disabled."
          >
            <RatingStarReadOnlyExample />
          </Tile>
          <Tile name="Rating with emoticons" span={4}>
            <RatingEmoticonExample />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
