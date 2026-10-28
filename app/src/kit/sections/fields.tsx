/* FIELDS — Base Web's form controls, demonstrated by Base's own docs examples.
 *
 * Every example file under bw-docs/examples/{input,textarea,form-control,checkbox,radio,switch,
 * slider} ships here as one Tile, in the order its docs page lists them, with any example the
 * page imports but does not render appended at the end. The example code is Uber's, and so is
 * every visible string; the edits are (a) docs-site-local imports -> chrome, (b) collision-free
 * component names, (c) type repairs against the shipped baseui version.
 *
 * This kit is GRAMMAR, not sentences. Demo copy stays Uber's own so that no example pre-decides
 * which control serves which moment of the product — that decision belongs to the situations
 * catalogue, later and explicitly.
 *
 * STEPPER has no examples directory in the docs — its page is a Yard playground and an exports
 * table only. Its four Tiles are built from the component's own source (bw-src/src/stepper) and
 * cover exactly the props its Yard config exposes: value, minValue, maxValue, disabled, overrides.
 *
 * COLOUR: where a Base example demonstrates a state (`error`, `positive`, `kind=negative`,
 * `$theme.colors.warning`) the prop stays exactly as Uber wrote it — the Rocoto theme collapses
 * negative/warning/positive onto ink, so the demonstration IS the theme working. Two literals in
 * input/overrides.tsx are the exception, noted at that example. The slider's custom thumb reads
 * its ring and fill from the theme so it re-inks with everything else; marked ↯ at that site.
 *
 * The only literal hexes left are the colour-name options the Selects carry as DATA — the hex is
 * the option's value (`valueKey="color"`), shown as text and never painted. Each says so with
 * `// theme-gate-allow`.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { useStyletron } from 'baseui';

import { Input, StatefulInput, MaskedInput, StyledInput, SIZE } from 'baseui/input';
import { Textarea, StatefulTextarea } from 'baseui/textarea';
import { FormControl } from 'baseui/form-control';
import { Checkbox, StatefulCheckbox, STYLE_TYPE } from 'baseui/checkbox';
import { Radio, RadioGroup, StatefulRadioGroup } from 'baseui/radio';
import type { RadioOverrides } from 'baseui/radio';
import { Switch, StatefulSwitch, LABEL_PLACEMENT, SIZE as SWITCH_SIZE } from 'baseui/switch';
import { Stepper } from 'baseui/stepper';
import { Slider, StatefulSlider } from 'baseui/slider';
import { Select } from 'baseui/select';
import { Button, SIZE as BUTTON_SIZE } from 'baseui/button';
import { Tag, HIERARCHY } from 'baseui/tag';
import { Search, Alert, Plus, CheckIndeterminate } from 'baseui/icon';
import { expandBorderStyles } from 'baseui/styles';
import { ParagraphSmall } from 'baseui/typography';
import { validate as validateEmail } from 'email-validator';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * INPUT — twelve examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function InputBasicControlledExample() {
  const [value, setValue] = React.useState('');
  return (
    <Input
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
      placeholder="Controlled Input"
    />
  );
}

function InputAvailableStatesExample() {
  return (
    <React.Fragment>
      <Input placeholder="simple" />
      <br />
      <Input value="uber" />
      <br />
      <Input placeholder="Input in an error state" error />
      <br />
      <Input placeholder="Input in an positive state" positive />
      <br />
      <Input placeholder="Disabled input" disabled />
      <br />
      <Input placeholder="ReadOnly input" readOnly />
    </React.Fragment>
  );
}

function InputSizesExample() {
  return (
    <React.Fragment>
      <Input size={SIZE.compact} placeholder="compact" />
      <br />
      <Input placeholder="default" />
      <br />
      <Input size={SIZE.large} placeholder="large" />
    </React.Fragment>
  );
}

function InputEnhancersExample() {
  return (
    <React.Fragment>
      <Input startEnhancer="@" placeholder="Input with a start enhancer" />
      <br />
      <Input endEnhancer=".00" placeholder="Input with an end enhancer" />
      <br />
      <Input
        startEnhancer="$"
        endEnhancer=".00"
        placeholder="Input with start and end enhancers"
      />
      <br />
      <Input
        endEnhancer={<Search size="18px" title="" />}
        placeholder="Input with an icon enhancer"
      />
    </React.Fragment>
  );
}

function InputMaskExample() {
  return <MaskedInput placeholder="Phone number" mask="(999) 999-9999" />;
}

function InputClearableExample() {
  const [value, setValue] = React.useState('Clear me!');
  return (
    <Input
      value={value}
      onChange={(event) => setValue(event.currentTarget.value)}
      clearable
    />
  );
}

function InputPasswordExample() {
  const [value, setValue] = React.useState('1234');
  return (
    <Input
      onChange={(event) => setValue(event.currentTarget.value)}
      type="password"
      value={value}
    />
  );
}

/* Uber's original hard-codes `darkseagreen` and `lightseagreen` for the focused state, and reads
 * `colors.shadowError` — a token baseui@16.1.1 no longer carries. Both are replaced by the theme's
 * own border tokens: the demonstration here is the Root override switching on $disabled / $error /
 * $isFocused, and that switch is intact. A literal green would also be the one thing this theme
 * cannot re-ink. */
function InputOverridesExample() {
  return (
    <Input
      overrides={{
        Root: {
          style: (props) => {
            const {
              $disabled,
              $error,
              $isFocused,
              $theme: { colors, sizing },
            } = props;
            const border = $disabled
              ? colors.borderTransparent
              : $error
                ? colors.borderNegative
                : $isFocused
                  ? colors.borderSelected
                  : colors.borderOpaque;
            return {
              borderLeftColor: border,
              borderRightColor: border,
              borderTopColor: border,
              borderBottomColor: border,
              boxShadow: `0 0 ${sizing.scale100} ${
                $disabled
                  ? 'transparent'
                  : $error
                    ? colors.borderNegative
                    : $isFocused
                      ? colors.borderSelected
                      : 'transparent'
              }`,
            };
          },
        },
      }}
      placeholder="Input with a custom InputContainer override"
    />
  );
}

function InputFocusExample() {
  const [css, theme] = useStyletron();
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <div className={css({ display: 'flex' })}>
      <Input
        inputRef={inputRef}
        placeholder="With input ref"
        overrides={{
          Root: {
            style: {
              width: '50%',
              marginRight: theme.sizing.scale400,
            },
          },
        }}
      />
      <Button onClick={() => inputRef.current && inputRef.current.focus()}>
        Click to focus
      </Button>
    </div>
  );
}

const InputTagsReplacement = React.forwardRef(
  ({ tags, removeTag, ...restProps }: any, ref) => {
    const [css] = useStyletron();
    return (
      <div
        className={css({
          flex: '1 1 0%',
          flexWrap: 'wrap',
          display: 'flex',
          alignItems: 'center',
        })}
      >
        {tags.map((tag: string, index: number) => (
          <Tag
            hierarchy={HIERARCHY.primary}
            onActionClick={() => removeTag(tag)}
            key={index}
          >
            {tag}
          </Tag>
        ))}
        <StyledInput ref={ref} {...restProps} />
      </div>
    );
  }
);

function InputWithTagsExample() {
  const [value, setValue] = React.useState('');
  const [tags, setTags] = React.useState(['hello']);
  const addTag = (tag: string) => {
    setTags([...tags, tag]);
  };
  const removeTag = (tag: string) => {
    setTags(tags.filter((t) => t !== tag));
  };
  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    switch (event.keyCode) {
      // Enter
      case 13: {
        if (!value) return;
        addTag(value);
        setValue('');
        return;
      }
      // Backspace
      case 8: {
        if (value || !tags.length) return;
        removeTag(tags[tags.length - 1]);
        return;
      }
    }
  };
  return (
    <Input
      placeholder={tags.length ? '' : 'Enter A Tag'}
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      overrides={{
        Input: {
          style: { width: 'auto', flexGrow: 1 },
          component: InputTagsReplacement,
          props: {
            tags: tags,
            removeTag: removeTag,
            onKeyDown: handleKeyDown,
          },
        },
      }}
    />
  );
}

/* Uber inlines this list in both FormControls of with-select.tsx; hoisted here so the two Selects
 * read the same array. The data is theirs, unchanged. */
const INPUT_SELECT_OPTIONS = [
  { id: 'AliceBlue', color: '#F0F8FF' }, // theme-gate-allow: select option data, never painted
  { id: 'AntiqueWhite', color: '#FAEBD7' }, // theme-gate-allow: select option data, never painted
  { id: 'Aqua', color: '#00FFFF' }, // theme-gate-allow: select option data, never painted
];

function InputSelectAtStart(props: any) {
  const [css] = useStyletron();
  return (
    <div className={css({ display: 'flex' })}>
      <div className={css({ width: '200px', paddingRight: '8px' })}>
        <Select
          options={props.options}
          labelKey="id"
          valueKey="color"
          onChange={({ value }) => props.onSelectChange(value)}
          value={props.selectValue}
          id={props.id}
        />
      </div>
      <Input
        onChange={(e) => props.onInputChange(e.currentTarget.value)}
        value={props.inputValue}
      />
    </div>
  );
}

function InputSelectAtEnd(props: any) {
  const [css] = useStyletron();
  return (
    <div className={css({ display: 'flex' })}>
      <Input
        onChange={(e) => props.onInputChange(e.currentTarget.value)}
        value={props.inputValue}
        id={props.id}
      />
      <div className={css({ width: '200px', paddingLeft: '8px' })}>
        <Select
          options={props.options}
          labelKey="id"
          valueKey="color"
          onChange={({ value }) => props.onSelectChange(value)}
          value={props.selectValue}
        />
      </div>
    </div>
  );
}

function InputWithSelectExample() {
  const [startInputValue, setStartInputValue] = React.useState('');
  const [startSelectValue, setStartSelectValue] = React.useState([]);
  const [endInputValue, setEndInputValue] = React.useState('');
  const [endSelectValue, setEndSelectValue] = React.useState([]);

  return (
    <div>
      <FormControl label="input with start select" caption="caption">
        <InputSelectAtStart
          inputValue={startInputValue}
          onInputChange={setStartInputValue}
          selectValue={startSelectValue}
          onSelectChange={setStartSelectValue}
          options={INPUT_SELECT_OPTIONS}
          id="start-id"
        />
      </FormControl>

      <FormControl label="input with end select" caption="caption">
        <InputSelectAtEnd
          inputValue={endInputValue}
          onInputChange={setEndInputValue}
          selectValue={endSelectValue}
          onSelectChange={setEndSelectValue}
          options={INPUT_SELECT_OPTIONS}
          id="end-id"
        />
      </FormControl>
    </div>
  );
}

function InputBasicUncontrolledExample() {
  return (
    <StatefulInput
      initialState={{ value: 'I manage my own state...' }}
      placeholder="I manage my own state..."
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TEXTAREA — six examples
 * The docs page for Textarea carries a Yard playground and the examples, and no prose at all —
 * so its Section note below is written from the component, not quoted from the page.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function TextareaBasicExample() {
  const [value, setValue] = React.useState('');
  return <Textarea value={value} onChange={(e) => setValue(e.currentTarget.value)} />;
}

function TextareaStatesExample() {
  const [valueA, setValueA] = React.useState('Positive state...');
  const [valueB, setValueB] = React.useState('Error state...');
  return (
    <React.Fragment>
      <Textarea
        positive
        value={valueA}
        onChange={(e) => setValueA(e.currentTarget.value)}
        placeholder="Positive state..."
      />
      <br />
      <Textarea
        error
        value={valueB}
        onChange={(e) => setValueB(e.currentTarget.value)}
        placeholder="Error state..."
      />
      <br />
      <Textarea disabled value="Disabled state..." />
      <br />
      <Textarea readOnly value="ReadOnly state..." />
    </React.Fragment>
  );
}

function TextareaSizesExample() {
  const [valueA, setValueA] = React.useState('Compact size...');
  const [valueB, setValueB] = React.useState('Default size...');
  const [valueC, setValueC] = React.useState('Large size...');
  return (
    <React.Fragment>
      <Textarea
        size={SIZE.compact}
        value={valueA}
        onChange={(e) => setValueA(e.currentTarget.value)}
        placeholder="Compact size..."
      />
      <br />
      <Textarea
        value={valueB}
        onChange={(e) => setValueB(e.currentTarget.value)}
        placeholder="Default size..."
      />
      <br />
      <Textarea
        size={SIZE.large}
        value={valueC}
        onChange={(e) => setValueC(e.currentTarget.value)}
        placeholder="Large size..."
      />
    </React.Fragment>
  );
}

function TextareaResizableExample() {
  const [value, setValue] = React.useState('');
  return (
    <Textarea
      value={value}
      onChange={(e) => setValue(e.currentTarget.value)}
      placeholder="Try resizing me..."
      resize="both"
    />
  );
}

function TextareaRefExample() {
  const [value, setValue] = React.useState('');
  const inputRef = React.useRef<HTMLTextAreaElement>(null);
  return (
    <React.Fragment>
      <Textarea
        inputRef={inputRef}
        value={value}
        onChange={(e) => setValue(e.currentTarget.value)}
        placeholder="Focus me by clicking the button below..."
      />
      <br />
      <Button
        onClick={() => {
          inputRef.current && inputRef.current.focus();
        }}
      >
        Focus Textarea
      </Button>
    </React.Fragment>
  );
}

function TextareaStatefulExample() {
  return (
    <StatefulTextarea
      initialState={{ value: 'I manage my own state...' }}
      onChange={console.log}
      placeholder="I manage my own state..."
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * FORM CONTROL — seven examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function FormControlInputExample() {
  const [value, setValue] = React.useState('');
  return (
    <FormControl label="Input label" caption="Input caption">
      <Input
        id="input-id"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
    </FormControl>
  );
}

function FormControlTextareaExample() {
  const [value, setValue] = React.useState('');
  return (
    <FormControl label="Textarea label" caption="Textarea caption">
      <Textarea
        id="textarea-id"
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      />
    </FormControl>
  );
}

function FormControlNegative() {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        display: 'flex',
        alignItems: 'center',
        paddingRight: theme.sizing.scale500,
        color: theme.colors.negative400,
      })}
    >
      <Alert size="18px" />
    </div>
  );
}

function FormControlValidationExample() {
  const [value, setValue] = React.useState('');
  const [isValid, setIsValid] = React.useState(false);
  const [isVisited, setIsVisited] = React.useState(false);
  const shouldShowError = !isValid && isVisited;
  /* Uber's docs type this handler to HTMLInputElement; baseui@16.1.1's onChange is declared over
   * HTMLInputElement | HTMLTextAreaElement, since Input and Textarea share the contract. Widened
   * to the shipped signature — `currentTarget.value` reads the same on both. */
  const onChange = (event: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { value } = event.currentTarget;
    setIsValid(validateEmail(value));
    setValue(value);
  };

  return (
    <FormControl
      label="Your email"
      error={shouldShowError ? 'Please input a valid email address' : null}
    >
      <Input
        id="input-id-validation"
        value={value}
        onChange={onChange}
        onBlur={() => setIsVisited(true)}
        error={shouldShowError}
        overrides={shouldShowError ? { After: FormControlNegative } : {}}
      />
    </FormControl>
  );
}

function FormControlCheckboxExample() {
  const [checked, setChecked] = React.useState(false);
  return (
    <FormControl label="Checkbox label" caption="Checkbox caption">
      <Checkbox checked={checked} onChange={() => setChecked(!checked)}>
        Checkbox control
      </Checkbox>
    </FormControl>
  );
}

function FormControlRadioGroupExample() {
  const [value, setValue] = React.useState('');
  return (
    <FormControl label="RadioGroup label" caption="RadioGroup caption">
      <RadioGroup
        value={value}
        onChange={(event) => setValue(event.currentTarget.value)}
      >
        <Radio value="red">Red</Radio>
        <Radio value="green">Green</Radio>
        <Radio value="blue">Blue</Radio>
      </RadioGroup>
    </FormControl>
  );
}

function FormControlSelectExample() {
  const [value, setValue] = React.useState([]);
  return (
    <FormControl label="Select label" caption="Select caption">
      <Select
        id="select-id"
        value={value}
        onChange={({ value }: any) => setValue(value)}
        options={[
          { id: 'AliceBlue', color: '#F0F8FF' }, // theme-gate-allow: select option data, never painted
          { id: 'AntiqueWhite', color: '#FAEBD7' }, // theme-gate-allow: select option data, never painted
          { id: 'Aqua', color: '#00FFFF' }, // theme-gate-allow: select option data, never painted
          { id: 'Aquamarine', color: '#7FFFD4' }, // theme-gate-allow: select option data, never painted
          { id: 'Azure', color: '#F0FFFF' }, // theme-gate-allow: select option data, never painted
          { id: 'Beige', color: '#F5F5DC' }, // theme-gate-allow: select option data, never painted
        ]}
        labelKey="id"
        valueKey="color"
      />
    </FormControl>
  );
}

function FormControlKindsExample() {
  return (
    <React.Fragment>
      <FormControl label="Input label" caption="Input caption">
        <Input />
      </FormControl>
      <FormControl
        positive="Positive caption"
        label="Input label"
        caption="Input caption"
      >
        <Input positive />
      </FormControl>
      <FormControl
        error="Error caption"
        label="Input label"
        caption="Input caption"
      >
        <Input error />
      </FormControl>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * CHECKBOX — eleven examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function CheckboxBasicControlledExample() {
  const [checked, setChecked] = React.useState(true);
  return (
    <Checkbox checked={checked} onChange={() => setChecked(!checked)}>
      click me
    </Checkbox>
  );
}

function CheckboxMultilineExample() {
  const [checked, setChecked] = React.useState(true);
  return (
    <Checkbox checked={checked} onChange={() => setChecked(!checked)}>
      It started as a simple idea: What if you could request a ride from your phone? More than 5
      billion trips later, we’re working to make transportation safer and more accessible, helping
      people order food quickly and affordably, reducing congestion in cities by getting more
      people into fewer cars, and creating opportunities for people to work on their own terms.
    </Checkbox>
  );
}

function CheckboxErrorExample() {
  const [checked, setChecked] = React.useState(true);
  return (
    <Checkbox checked={checked} onChange={() => setChecked(!checked)} error>
      Checkbox with an error
    </Checkbox>
  );
}

function CheckboxIndeterminateExample() {
  const [css, theme] = useStyletron();
  const [checkboxes, setCheckboxes] = React.useState([true, false]);

  const allChecked = checkboxes.every(Boolean);
  const isIndeterminate = checkboxes.some(Boolean) && !allChecked;

  return (
    <div>
      <Checkbox
        onChange={(e) => {
          const target = e.target as HTMLInputElement;
          setCheckboxes([target.checked, target.checked]);
        }}
        isIndeterminate={isIndeterminate}
        checked={allChecked}
      >
        Indeterminate checkbox if not all subcheckboxes are checked
      </Checkbox>
      <div className={css({ padding: theme.sizing.scale400 })}>
        <Checkbox
          checked={checkboxes[0]}
          onChange={(e) => {
            const target = e.target as HTMLInputElement;
            setCheckboxes([target.checked, checkboxes[1]]);
          }}
        >
          First subcheckbox
        </Checkbox>
        <Checkbox
          checked={checkboxes[1]}
          onChange={(e) => {
            const target = e.target as HTMLInputElement;
            setCheckboxes([checkboxes[0], target.checked]);
          }}
        >
          Second subcheckbox
        </Checkbox>
      </div>
    </div>
  );
}

function CheckboxDisabledExample() {
  return (
    <React.Fragment>
      <Checkbox disabled>Disabled checkbox</Checkbox>
      <Checkbox disabled checked>
        Disabled checkbox (checked)
      </Checkbox>
    </React.Fragment>
  );
}

function CheckboxAlignmentExample() {
  const [checkboxes, setCheckboxes] = React.useState([false, false, false, false]);
  return (
    <React.Fragment>
      <Checkbox
        checked={checkboxes[0]}
        onChange={(e) => {
          const nextCheckboxes = [...checkboxes];
          nextCheckboxes[0] = e.currentTarget.checked;
          setCheckboxes(nextCheckboxes);
        }}
        labelPlacement="top"
      >
        Label on the top
      </Checkbox>
      <div
        style={{
          display: 'flex',
          justifyContent: 'center',
          margin: '8px 0 8px 12px',
        }}
      >
        <Checkbox
          checked={checkboxes[1]}
          onChange={(e) => {
            const nextCheckboxes = [...checkboxes];
            nextCheckboxes[1] = e.currentTarget.checked;
            setCheckboxes(nextCheckboxes);
          }}
          labelPlacement="left"
        >
          Label on the left
        </Checkbox>
        <Checkbox
          checked={checkboxes[2]}
          onChange={(e) => {
            const nextCheckboxes = [...checkboxes];
            nextCheckboxes[2] = e.currentTarget.checked;
            setCheckboxes(nextCheckboxes);
          }}
          labelPlacement="right"
        >
          Label on the right
        </Checkbox>
      </div>
      <Checkbox
        checked={checkboxes[3]}
        onChange={(e) => {
          const nextCheckboxes = [...checkboxes];
          nextCheckboxes[3] = e.currentTarget.checked;
          setCheckboxes(nextCheckboxes);
        }}
        labelPlacement="bottom"
      >
        Label on the bottom
      </Checkbox>
    </React.Fragment>
  );
}

function CheckboxOverridesExample() {
  const [checked, setChecked] = React.useState(true);
  return (
    <Checkbox
      checked={checked}
      onChange={() => setChecked(!checked)}
      overrides={{
        Root: {
          style: ({ $theme }) => ({
            ...expandBorderStyles($theme.borders.border300),
          }),
        },
        Label: {
          style: ({ $theme }) => ({
            color: $theme.colors.warning,
          }),
        },
        Checkmark: {
          style: ({ $checked, $theme }) => ({
            borderLeftColor: $theme.colors.warning,
            borderRightColor: $theme.colors.warning,
            borderTopColor: $theme.colors.warning,
            borderBottomColor: $theme.colors.warning,
            backgroundColor: $checked ? $theme.colors.warning : null,
          }),
        },
      }}
    >
      With style overrides
    </Checkbox>
  );
}

function CheckboxComponentOverridesExample() {
  const [css, theme] = useStyletron();
  return (
    <StatefulCheckbox
      onChange={console.log}
      overrides={{
        /* A component override receives every shared prop the slot carries; baseui types that
         * bag loosely, so `props` is annotated rather than inferred. `props.checked` is the value
         * Uber's example reads. */
        Checkmark: (props: any) => (
          <div
            className={css({
              color: props.checked ? theme.colors.primary : theme.colors.mono700,
              marginTop: '3px',
              marginRight: '3px',
            })}
          >
            <Alert />
          </div>
        ),
      }}
    >
      With style overrides
    </StatefulCheckbox>
  );
}

function CheckboxFocusExample() {
  const [checked, setChecked] = React.useState(true);
  const [focused, setFocused] = React.useState(false);
  const inputRef = React.useRef<HTMLInputElement>(null);
  return (
    <React.Fragment>
      <Button
        size={BUTTON_SIZE.compact}
        onClick={() => {
          if (inputRef.current === null) return;
          if (focused) {
            inputRef.current.blur();
            setFocused(false);
          } else {
            inputRef.current.focus();
            setFocused(true);
          }
        }}
      >
        Click to focus checkbox
      </Button>
      <Checkbox
        inputRef={inputRef}
        checked={checked}
        onChange={() => setChecked(!checked)}
      >
        Focused checkbox
      </Checkbox>
    </React.Fragment>
  );
}

function CheckboxToggleExample() {
  const [checkboxes, setCheckboxes] = React.useState([false, false]);
  return (
    <React.Fragment>
      <Checkbox
        checked={checkboxes[0]}
        onChange={(e) => {
          const nextCheckboxes = [...checkboxes];
          nextCheckboxes[0] = e.currentTarget.checked;
          setCheckboxes(nextCheckboxes);
        }}
        checkmarkType={STYLE_TYPE.toggle_round}
      >
        toggle me
      </Checkbox>
      <br />
      <Checkbox
        disabled
        checked={checkboxes[1]}
        onChange={(e) => {
          const nextCheckboxes = [...checkboxes];
          nextCheckboxes[1] = e.currentTarget.checked;
          setCheckboxes(nextCheckboxes);
        }}
        checkmarkType={STYLE_TYPE.toggle_round}
      >
        disabled toggle
      </Checkbox>
    </React.Fragment>
  );
}

function CheckboxBasicUncontrolledExample() {
  return <StatefulCheckbox onChange={console.log}>click me</StatefulCheckbox>;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * RADIO — six examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function RadioBasicExample() {
  const [value, setValue] = React.useState('1');
  return (
    <RadioGroup name="basic usage" onChange={(e) => setValue(e.target.value)} value={value}>
      <Radio value="1">First</Radio>
      <Radio
        value="2"
        description="This is a radio description, it gives a little more in-yo-face context about what this is."
      >
        Second
      </Radio>
      <Radio value="3">Third</Radio>
    </RadioGroup>
  );
}

function RadioDisabledExample() {
  return (
    <RadioGroup disabled name="disabled" value="1">
      <Radio value="1">Checked</Radio>
      <Radio value="2">Unchecked</Radio>
    </RadioGroup>
  );
}

function RadioHorizontalAlignExample() {
  const [value, setValue] = React.useState('1');
  return (
    <RadioGroup
      align="horizontal"
      name="horizontal"
      onChange={(e) => setValue(e.target.value)}
      value={value}
    >
      <Radio value="1">First</Radio>
      <Radio value="2">Second</Radio>
      <Radio value="3">Third</Radio>
    </RadioGroup>
  );
}

function RadioErrorExample() {
  const [value, setValue] = React.useState('1');
  return (
    <RadioGroup error name="error" onChange={(e) => setValue(e.target.value)} value={value}>
      <Radio value="1">First</Radio>
      <Radio value="2">Second</Radio>
      <Radio value="3">Third</Radio>
    </RadioGroup>
  );
}

function RadioOverridesExample() {
  const [value, setValue] = React.useState('1');
  const radioOverrides: RadioOverrides = {
    Label: ({ $value }) => (
      <ParagraphSmall>Custom label for value: {$value}</ParagraphSmall>
    ),
    RadioMarkOuter: {
      style: ({ $theme }) => ({
        backgroundColor: $theme.colors.positive,
      }),
    },
  };
  return (
    <RadioGroup name="overrides" onChange={(e) => setValue(e.target.value)} value={value}>
      <Radio overrides={radioOverrides} value="1">
        First
      </Radio>
      <Radio overrides={radioOverrides} value="2">
        Second
      </Radio>
      <Radio overrides={radioOverrides} value="3">
        Third
      </Radio>
    </RadioGroup>
  );
}

function RadioStatefulExample() {
  return (
    <StatefulRadioGroup name="stateful" initialState={{ value: '2' }}>
      <Radio value="1">First</Radio>
      <Radio value="2">Second</Radio>
      <Radio value="3">Third</Radio>
    </StatefulRadioGroup>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SWITCH — eight examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function SwitchBasicControlledExample() {
  const [checked, setChecked] = React.useState(true);
  return (
    <Switch checked={checked} onChange={() => setChecked(!checked)}>
      click me
    </Switch>
  );
}

function SwitchMultilineExample() {
  const [checked, setChecked] = React.useState(true);
  return (
    <Switch checked={checked} onChange={() => setChecked(!checked)}>
      It started as a simple idea: What if you could request a ride from your phone? More than 5
      billion trips later, we’re working to make transportation safer and more accessible, helping
      people order food quickly and affordably, reducing congestion in cities by getting more
      people into fewer cars, and creating opportunities for people to work on their own terms.
    </Switch>
  );
}

function SwitchDisabledExample() {
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        gap: '4px',
      }}
    >
      <Switch disabled>Disabled switch</Switch>
      <Switch disabled checked>
        Disabled switch (checked)
      </Switch>
    </div>
  );
}

function SwitchAlignmentExample() {
  const [switches, setSwitches] = React.useState([false, false]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: '4px',
      }}
    >
      <Switch
        checked={switches[0]}
        onChange={(e) => {
          const nextSwitches = [...switches];
          nextSwitches[0] = e.currentTarget.checked;
          setSwitches(nextSwitches);
        }}
        labelPlacement={LABEL_PLACEMENT.left}
      >
        Label on the left
      </Switch>
      <Switch
        checked={switches[1]}
        onChange={(e) => {
          const nextSwitches = [...switches];
          nextSwitches[1] = e.currentTarget.checked;
          setSwitches(nextSwitches);
        }}
        labelPlacement={LABEL_PLACEMENT.right}
      >
        Label on the right
      </Switch>
    </div>
  );
}

function SwitchSizeExample() {
  const [switches, setSwitches] = React.useState([false, false]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: '4px',
      }}
    >
      <Switch
        checked={switches[0]}
        onChange={(e) => {
          const nextSwitches = [...switches];
          nextSwitches[0] = e.currentTarget.checked;
          setSwitches(nextSwitches);
        }}
        size={SWITCH_SIZE.default}
      >
        Default size
      </Switch>
      <Switch
        checked={switches[1]}
        onChange={(e) => {
          const nextSwitches = [...switches];
          nextSwitches[1] = e.currentTarget.checked;
          setSwitches(nextSwitches);
        }}
        size={SWITCH_SIZE.small}
      >
        Small size
      </Switch>
    </div>
  );
}

function SwitchShowIconExample() {
  const [switches, setSwitches] = React.useState([true, true]);
  return (
    <div
      style={{
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-start',
        gap: '4px',
      }}
    >
      <Switch
        checked={switches[0]}
        onChange={(e) => {
          const nextSwitches = [...switches];
          nextSwitches[0] = e.currentTarget.checked;
          setSwitches(nextSwitches);
        }}
        showIcon={false}
      >
        No Icon
      </Switch>
      <Switch
        checked={switches[1]}
        onChange={(e) => {
          const nextSwitches = [...switches];
          nextSwitches[1] = e.currentTarget.checked;
          setSwitches(nextSwitches);
        }}
        showIcon={true}
      >
        Show Icon
      </Switch>
    </div>
  );
}

function SwitchOverridesExample() {
  const [checked, setChecked] = React.useState(true);
  return (
    <Switch
      checked={checked}
      onChange={() => setChecked(!checked)}
      overrides={{
        Root: {
          style: ({ $theme }) => ({
            ...expandBorderStyles($theme.borders.border300),
          }),
        },
        Label: {
          style: ({ $theme }) => ({
            color: $theme.colors.warning,
          }),
        },
        Toggle: {
          style: ({ $checked, $theme }) => ({
            borderLeftColor: $theme.colors.warning,
            borderRightColor: $theme.colors.warning,
            borderTopColor: $theme.colors.warning,
            borderBottomColor: $theme.colors.warning,
            backgroundColor: $checked
              ? $theme.colors.backgroundAccent
              : $theme.colors.backgroundWarning,
          }),
        },
      }}
    >
      With style overrides
    </Switch>
  );
}

function SwitchBasicUncontrolledExample() {
  return <StatefulSwitch onChange={console.log}>click me</StatefulSwitch>;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * STEPPER — built from the component's own source
 * The docs ship no examples directory for Stepper: its page is a Yard playground plus an exports
 * table. These four demonstrate exactly the props the Yard config exposes — value + setValue,
 * minValue/maxValue, disabled, and the six override slots — using the real baseui/stepper.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function StepperBasicExample() {
  const [value, setValue] = React.useState(3);
  return <Stepper value={value} setValue={setValue} />;
}

function StepperMinMaxExample() {
  const [value, setValue] = React.useState(6);
  return <Stepper value={value} setValue={setValue} minValue={2} maxValue={12} />;
}

function StepperDisabledExample() {
  const [value, setValue] = React.useState(4);
  return <Stepper value={value} setValue={setValue} disabled />;
}

function StepperOverridesExample() {
  const [value, setValue] = React.useState(5);
  return (
    <Stepper
      value={value}
      setValue={setValue}
      minValue={1}
      maxValue={20}
      overrides={{
        Root: {
          style: ({ $theme }) => ({
            ...expandBorderStyles($theme.borders.border300),
            borderTopLeftRadius: $theme.borders.radius300,
            borderTopRightRadius: $theme.borders.radius300,
            borderBottomLeftRadius: $theme.borders.radius300,
            borderBottomRightRadius: $theme.borders.radius300,
          }),
        },
        DecrementButtonIcon: () => <CheckIndeterminate size="14px" title="" />,
        IncrementButtonIcon: () => <Plus size="14px" title="" />,
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SLIDER — eight examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

function SliderBasicExample() {
  const [value, setValue] = React.useState([60]);
  return <Slider value={value} onChange={({ value }) => setValue(value)} />;
}

function SliderMarksExample() {
  const [value, setValue] = React.useState([60]);
  return (
    <Slider value={value} step={10} marks onChange={({ value }) => value && setValue(value)} />
  );
}

function SliderRangeExample() {
  const [value, setValue] = React.useState([25, 75]);
  return <Slider value={value} onChange={({ value }) => setValue(value)} />;
}

function SliderDisabledExample() {
  const [value, setValue] = React.useState([40]);
  return <Slider disabled value={value} onChange={({ value }) => setValue(value)} />;
}

function SliderStepMinMaxExample() {
  const [value, setValue] = React.useState([90]);
  return (
    <Slider
      value={value}
      min={-300}
      max={300}
      step={10}
      onChange={({ value }) => setValue(value)}
    />
  );
}

/* The thumb speaks metres and the tick bar converts to kilometres — Uber's own conversion, so the
 * example demonstrates a scale whose units differ from the value's. */
const mToKm = (value: number) => `${(value / 1000).toFixed(1)}km`;

function SliderCustomTicksExample() {
  const [value, setValue] = React.useState([4500]);
  const [css, theme] = useStyletron();
  return (
    <Slider
      value={value}
      min={1000}
      max={8000}
      step={100}
      onChange={({ value }) => setValue(value)}
      overrides={{
        Root: {
          style: {
            marginTop: '24px',
          },
        },
        InnerThumb: () => null,
        ThumbValue: ({ $value }) => (
          <div
            className={css({
              position: 'absolute',
              top: `-${theme.sizing.scale800}`,
              ...theme.typography.font200,
              backgroundColor: 'transparent',
            })}
          >
            {$value}m
          </div>
        ),
        TickBar: ({ $min, $max }) => (
          <div
            className={css({
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              paddingRight: theme.sizing.scale600,
              paddingLeft: theme.sizing.scale600,
              paddingBottom: theme.sizing.scale400,
            })}
          >
            <div>{mToKm($min)}</div>
            <div>{mToKm(2400)}</div>
            <div>{mToKm(3800)}</div>
            <div>{mToKm(5200)}</div>
            <div>{mToKm(6600)}</div>
            <div>{mToKm($max)}</div>
          </div>
        ),
      }}
    />
  );
}

function SliderOverridesExample() {
  const [value, setValue] = React.useState([70]);
  return (
    <Slider
      value={value}
      onChange={({ value }) => setValue(value)}
      overrides={{
        InnerThumb: ({ $value, $thumbIndex }) => (
          <React.Fragment>{$value[$thumbIndex]}</React.Fragment>
        ),
        ThumbValue: () => null,
        /* ↯ Uber's custom thumb is a grey ring on a white disc, both written as literals the
         * theme cannot reach. The ring takes the hairline token and the disc takes the paper,
         * so the thumb re-inks with the brand; its 36px circle and 3px ring are Uber's geometry,
         * untouched, because the shape is what the example demonstrates. */
        Thumb: {
          style: ({ $theme }) => ({
            height: '36px',
            width: '36px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            borderTopLeftRadius: '36px',
            borderTopRightRadius: '36px',
            borderBottomRightRadius: '36px',
            borderBottomLeftRadius: '36px',
            borderLeftStyle: 'solid',
            borderRightStyle: 'solid',
            borderTopStyle: 'solid',
            borderBottomStyle: 'solid',
            borderLeftWidth: '3px',
            borderTopWidth: '3px',
            borderRightWidth: '3px',
            borderBottomWidth: '3px',
            borderLeftColor: $theme.colors.borderOpaque,
            borderTopColor: $theme.colors.borderOpaque,
            borderRightColor: $theme.colors.borderOpaque,
            borderBottomColor: $theme.colors.borderOpaque,
            backgroundColor: $theme.colors.backgroundPrimary,
          }),
        },
      }}
    />
  );
}

function SliderStatefulExample() {
  return <StatefulSlider />;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE SECTION
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function FieldsSection() {
  return (
    <>
      <Section t="Input" n="When a person should provide information to the application.">
        <Grid>
          <Tile
            name="Basic usage"
            span={4}
            rule="A controlled field: the value lives in your state, onChange writes it back."
          >
            <InputBasicControlledExample />
          </Tile>
          <Tile
            name="States"
            span={4}
            rule="error, positive, disabled and readOnly are props, not colours you pick."
          >
            <InputAvailableStatesExample />
          </Tile>
          <Tile name="Sizes" span={4} rule="Three heights off Base's own sizing scale.">
            <InputSizesExample />
          </Tile>
          <Tile
            name="Enhancers"
            span={4}
            rule="A unit or an icon riding inside the field, on the value's own line."
          >
            <InputEnhancersExample />
          </Tile>
          <Tile
            name="MaskedInput"
            span={4}
            rule="A fixed format applied as the person types."
          >
            <InputMaskExample />
          </Tile>
          <Tile
            name="Clearable"
            span={4}
            rule="clearable adds the clear control; Escape clears too, unless clearOnEscape is off."
          >
            <InputClearableExample />
          </Tile>
          <Tile
            name="Input for passwords"
            span={4}
            rule="type=password adds its own show/hide toggle."
          >
            <InputPasswordExample />
          </Tile>
          <Tile
            name="Overrides usage"
            span={4}
            rule="The Root override reads $disabled, $error and $isFocused off the component."
          >
            <InputOverridesExample />
          </Tile>
          <Tile
            name="Stateful (uncontrolled) usage"
            span={4}
            rule="StatefulInput keeps its own value and reports changes."
          >
            <InputBasicUncontrolledExample />
          </Tile>
          <Tile
            name="Focus and ref"
            span={6}
            rule="inputRef hands you the real DOM node to focus."
          >
            <InputFocusExample />
          </Tile>
          <Tile
            name="Create/Delete Tags"
            span={6}
            rule="The Input slot swapped for a component that renders Tags beside the caret."
          >
            <InputWithTagsExample />
          </Tile>
          <Tile
            name="Combined with a Select component"
            span={12}
            rule="A Select adjoined to the field, at either end."
          >
            <InputWithSelectExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Textarea"
        n="When the information a person types runs longer than a single line."
      >
        <Grid>
          <Tile name="Basic usage" span={6} rule="Same controlled contract as Input.">
            <TextareaBasicExample />
          </Tile>
          <Tile
            name="States"
            span={6}
            rule="positive, error, disabled and readOnly, carried by the same props as Input."
          >
            <TextareaStatesExample />
          </Tile>
          <Tile name="Sizes" span={6} rule="Textarea reads Input's SIZE constants.">
            <TextareaSizesExample />
          </Tile>
          <Tile
            name="Allow the user to resize"
            span={6}
            rule="resize is off by default; overrides can bound the min and max dimensions."
          >
            <TextareaResizableExample />
          </Tile>
          <Tile name="Focus and ref" span={6} rule="inputRef points at the textarea node.">
            <TextareaRefExample />
          </Tile>
          <Tile
            name="Stateful (uncontrolled) usage"
            span={6}
            rule="StatefulTextarea manages its own value."
          >
            <TextareaStatefulExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Form Control"
        n="Adds a label and a caption to the single control it wraps; an error message takes the caption's place."
      >
        <Grid>
          <Tile
            name="Input"
            span={4}
            rule="The child's id becomes the label's htmlFor."
          >
            <FormControlInputExample />
          </Tile>
          <Tile
            name="Checkbox"
            span={4}
            rule="For a Checkbox the real label is the text beside the box."
          >
            <FormControlCheckboxExample />
          </Tile>
          <Tile name="RadioGroup" span={4} rule="One label and caption over the whole group.">
            <FormControlRadioGroupExample />
          </Tile>
          <Tile name="Select" span={4} rule="Same contract as any other single child.">
            <FormControlSelectExample />
          </Tile>
          <Tile name="Textarea" span={6} rule="Label above, caption below, error in its place.">
            <FormControlTextareaExample />
          </Tile>
          <Tile
            name="Validation example (with email)"
            span={6}
            rule="Client-side validation driving the control's error state and an After enhancer."
          >
            <FormControlValidationExample />
          </Tile>
          <Tile
            name="States"
            span={6}
            rule="positive and error take strings and print them where the caption sits."
          >
            <FormControlKindsExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Checkbox"
        n="When options share a context, when a person toggles one on or off, or when several may be selected at once."
      >
        <Grid>
          <Tile name="Basic usage" span={4} rule="checked plus onChange; the label is the child.">
            <CheckboxBasicControlledExample />
          </Tile>
          <Tile name="Error state" span={4} rule="error is a prop the theme paints.">
            <CheckboxErrorExample />
          </Tile>
          <Tile name="Disabled state" span={4} rule="Disabled reads in both checked positions.">
            <CheckboxDisabledExample />
          </Tile>
          <Tile
            name="Overriding styles"
            span={4}
            rule="Root, Label and Checkmark each take a style function."
          >
            <CheckboxOverridesExample />
          </Tile>
          <Tile
            name="Overriding sub-components"
            span={4}
            rule="A whole slot replaced by your own component."
          >
            <CheckboxComponentOverridesExample />
          </Tile>
          <Tile name="Focus and ref" span={4} rule="inputRef focuses and blurs the real input.">
            <CheckboxFocusExample />
          </Tile>
          <Tile
            name="As a toggle"
            span={4}
            rule="checkmarkType=toggle_round turns the box into a switch."
          >
            <CheckboxToggleExample />
          </Tile>
          <Tile
            name="Stateful (uncontrolled) usage"
            span={4}
            rule="StatefulCheckbox keeps its own checked state."
          >
            <CheckboxBasicUncontrolledExample />
          </Tile>
          <Tile
            name="Multiple lines"
            span={6}
            rule="The label wraps and the box stays aligned to the first line."
          >
            <CheckboxMultilineExample />
          </Tile>
          <Tile
            name="Indeterminate state"
            span={6}
            rule="isIndeterminate is the third position, for a parent over a partial set."
          >
            <CheckboxIndeterminateExample />
          </Tile>
          <Tile
            name="Alignments"
            span={6}
            rule="labelPlacement puts the label on any of the four sides."
          >
            <CheckboxAlignmentExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Radio"
        n="When the person should see every available option and pick exactly one."
      >
        <Grid>
          <Tile
            name="Basic usage"
            span={6}
            rule="RadioGroup owns the value; description adds a second line under an option."
          >
            <RadioBasicExample />
          </Tile>
          <Tile
            name="Horizontal alignment"
            span={6}
            rule="align laid horizontally for short option sets."
          >
            <RadioHorizontalAlignExample />
          </Tile>
          <Tile name="Disabled radios" span={4} rule="disabled on the group covers every option.">
            <RadioDisabledExample />
          </Tile>
          <Tile name="Error state" span={4} rule="error on the group, not on each radio.">
            <RadioErrorExample />
          </Tile>
          <Tile
            name="Stateful (uncontrolled) usage"
            span={4}
            rule="StatefulRadioGroup starts from initialState and tracks itself."
          >
            <RadioStatefulExample />
          </Tile>
          <Tile
            name="Overrides usage"
            span={6}
            rule="One overrides object shared by every radio in the group."
          >
            <RadioOverridesExample />
          </Tile>
        </Grid>
      </Section>

      <Section t="Switch" n="When a person turns a single option on or off.">
        <Grid>
          <Tile name="Basic usage" span={4} rule="checked plus onChange, same contract as Checkbox.">
            <SwitchBasicControlledExample />
          </Tile>
          <Tile name="Disabled state" span={4} rule="Disabled reads in both positions.">
            <SwitchDisabledExample />
          </Tile>
          <Tile name="Alignments" span={4} rule="labelPlacement puts the label left or right.">
            <SwitchAlignmentExample />
          </Tile>
          <Tile name="Sizes" span={4} rule="Two sizes: default and small.">
            <SwitchSizeExample />
          </Tile>
          <Tile name="ShowIcon" span={4} rule="showIcon prints the state inside the knob.">
            <SwitchShowIconExample />
          </Tile>
          <Tile
            name="Overriding styles"
            span={4}
            rule="Root, Label and Toggle each take a style function."
          >
            <SwitchOverridesExample />
          </Tile>
          <Tile
            name="Stateful (uncontrolled) usage"
            span={4}
            rule="StatefulSwitch keeps its own checked state."
          >
            <SwitchBasicUncontrolledExample />
          </Tile>
          <Tile
            name="Multiple lines"
            span={6}
            rule="The label wraps and the switch stays on the first line."
          >
            <SwitchMultilineExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Stepper"
        n="When a person raises or lowers a small whole number, such as the number of riders in a vehicle."
      >
        <Grid>
          <Tile
            name="Basic usage"
            span={4}
            rule="value and setValue; the number itself is an editable field."
          >
            <StepperBasicExample />
          </Tile>
          <Tile
            name="Minimum and maximum"
            span={4}
            rule="minValue and maxValue disable the button at each end."
          >
            <StepperMinMaxExample />
          </Tile>
          <Tile name="Disabled" span={4} rule="disabled covers both buttons and the field.">
            <StepperDisabledExample />
          </Tile>
          <Tile
            name="Overrides"
            span={4}
            rule="Six slots: Root, Input, and each button with its icon."
          >
            <StepperOverridesExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Slider"
        n="When a person picks a single value, or a range, between a minimum and a maximum."
      >
        <Grid>
          <Tile
            name="Basic usage"
            span={6}
            rule="The value is always an array; one entry is one thumb."
          >
            <SliderBasicExample />
          </Tile>
          <Tile name="Marks" span={6} rule="marks prints a tick at every step.">
            <SliderMarksExample />
          </Tile>
          <Tile name="Range" span={6} rule="Two entries in the array make it a range.">
            <SliderRangeExample />
          </Tile>
          <Tile name="Disabled state" span={6} rule="The thumb stops taking pointer and keys.">
            <SliderDisabledExample />
          </Tile>
          <Tile
            name="Custom min, max and step"
            span={6}
            rule="min, max and step accept negatives."
          >
            <SliderStepMinMaxExample />
          </Tile>
          <Tile
            name="Custom ticks"
            span={6}
            rule="ThumbValue and TickBar replaced, so the thumb and the scale speak different units."
          >
            <SliderCustomTicksExample />
          </Tile>
          <Tile
            name="Overrides usage"
            span={6}
            rule="InnerThumb carries the value, so ThumbValue can go."
          >
            <SliderOverridesExample />
          </Tile>
          <Tile
            name="Stateful (uncontrolled) usage"
            span={6}
            rule="StatefulSlider needs no props at all."
          >
            <SliderStatefulExample />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
