/* TIME — Base Web's date, time and timezone pickers, demonstrated by Base's own docs examples.
 *
 * Every example file under bw-docs/examples/{datepicker,timepicker,timezonepicker} ships here as
 * one Tile, in the order its docs page lists them. Twenty examples: seventeen datepicker, two
 * timepicker, one timezone picker. The example code is Uber's, and so is every visible string —
 * labels, captions, placeholders, aria-labels, option ids, dates. This file is grammar, not
 * sentences: which control serves which moment of a product is decided in the situations
 * catalogue, later and explicitly, so nothing here pre-decides it.
 *
 * THE EDITS ARE STRUCTURAL ONLY: (a) docs-site-local imports -> chrome, (b) collision-free
 * component and constant names, (c) type repairs where the docs example relies on the docs site's
 * looser setup.
 *
 * COLOUR: where a Base example demonstrates a state (`error`, `positive`, `$theme.colors.positive`
 * in an override) the prop stays exactly as Uber wrote it — the Rocoto theme collapses
 * negative/warning/positive onto ink, so the demonstration IS the theme working. ONE exception,
 * noted at the Tile: nested-override.tsx hard-codes `backgroundColor: 'salmon'` and
 * `color: 'white'`. Those are raw literals the theme cannot re-ink, so they would paint an actual
 * salmon pink onto the page. They are swapped for the theme's own accent tokens; the override
 * mechanism being demonstrated is identical.
 *
 * DEPENDENCIES: date-fns and date-fns-tz resolve from node_modules (baseui's own dependencies);
 * neither is declared in this app's package.json, and nothing was installed for this section.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';
import { useStyletron } from 'baseui';

import {
  StatefulCalendar,
  Datepicker,
  DatePicker,
  StatefulDatepicker,
  StatefulDatePicker,
  ORIENTATION,
} from 'baseui/datepicker';
import { TimePicker } from 'baseui/timepicker';
import { TimezonePicker } from 'baseui/timezonepicker';
import { FormControl } from 'baseui/form-control';
import { Select } from 'baseui/select';
import { LabelSmall } from 'baseui/typography';
import { ArrowRight } from 'baseui/icon';

import { isAfter, isBefore, addDays } from 'date-fns';
import hu from 'date-fns/locale/hu';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * DATEPICKER — seventeen examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* examples/datepicker/basic.tsx */
function DatepickerBasicExample() {
  return (
    <StatefulCalendar
      // use the 'onChange' prop to pull data from the component into your application state
      onChange={({ date }) => console.log(date)}
    />
  );
}

/* examples/datepicker/in-popover.tsx */
function DatepickerInPopoverExample() {
  const [singleDate, setSingleDate] = React.useState<any>(null);
  const [rangeDate, setRangeDate] = React.useState<any>([new Date(), addDays(new Date(), 4)]);

  return (
    <React.Fragment>
      <DatePicker value={singleDate} onChange={({ date }) => setSingleDate(date)} />
      <br />
      <DatePicker
        range
        value={rangeDate}
        onChange={({ date }) => setRangeDate(date)}
        placeholder="YYYY/MM/DD – YYYY/MM/DD"
      />
    </React.Fragment>
  );
}

/* examples/datepicker/quick-select.tsx */
function DatepickerQuickSelectExample() {
  return <StatefulCalendar onChange={({ date }) => console.log(date)} range quickSelect />;
}

/* examples/datepicker/i18n.tsx — the example's whole subject is localization, so it keeps the
 * date-fns locale Uber picked to demonstrate it. */
function DatepickerI18nExample() {
  return (
    <StatefulDatepicker
      locale={hu}
      onChange={({ date }) => console.log(date)}
      formatString="yyyy MMMM d"
      placeholder="YYYY MMMM d"
      mask={null}
    />
  );
}

/* examples/datepicker/with-overrides.tsx — `positive` is Uber's own choice of token and it stays:
 * the Rocoto theme collapses positive onto ink, so this paints ink. That is the theme working. */
function DatepickerWithOverridesExample() {
  return (
    <StatefulCalendar
      initialState={{ value: new Date() }}
      overrides={{
        CalendarHeader: {
          style: ({ $theme }) => ({
            backgroundColor: $theme.colors.positive,
          }),
        },
        MonthHeader: {
          style: ({ $theme }) => ({
            backgroundColor: $theme.colors.positive,
          }),
        },
        MonthYearSelectButton: {
          style: ({ $theme }) => ({
            ':focus': {
              backgroundColor: $theme.colors.positive500,
              outline: 'none',
            },
          }),
        },
        PrevButton: {
          style: ({ $theme }) => {
            return {
              ':focus': {
                backgroundColor: $theme.colors.positive500,
              },
            };
          },
        },
        NextButton: {
          style: ({ $theme }) => {
            return {
              ':focus': {
                backgroundColor: $theme.colors.positive500,
              },
            };
          },
        },
        Day: {
          style: ({ $theme, $selected, $isHovered, $isHighlighted }) => ({
            backgroundColor: $selected
              ? $theme.colors.positive
              : $isHovered || $isHighlighted
                ? $theme.colors.positive100
                : 'transparent',
          }),
        },
      }}
    />
  );
}

/* examples/datepicker/with-mask.tsx */
function DatepickerWithMaskExample() {
  const [date, setDate] = React.useState(new Date('2020/01/01'));
  return (
    <Datepicker
      aria-label="Select a date"
      value={date}
      onChange={({ date }) => setDate(date as Date)}
      formatString="yyyy-MM-dd"
      placeholder="YYYY-MM-DD"
      mask="9999-99-99"
    />
  );
}

/* examples/datepicker/null-mask.tsx */
function DatepickerNullMaskExample() {
  const [date, setDate] = React.useState(new Date('2020/01/01'));
  return (
    <Datepicker
      aria-label="Select a date"
      value={date}
      onChange={({ date }) => setDate(date as Date)}
      formatString="d.M.yyyy"
      placeholder="dd.mm.yyyy"
      mask={null}
    />
  );
}

/* examples/datepicker/calendar-time-select.tsx */
function CalendarTimeSelectExample() {
  return <StatefulCalendar onChange={({ date }) => console.log(date)} timeSelectStart />;
}

/* examples/datepicker/calendar-multiple-months.tsx */
function CalendarMultipleMonthsExample() {
  return (
    <StatefulCalendar
      onChange={({ date }) => console.log(date)}
      orientation={ORIENTATION.horizontal}
      monthsShown={2}
      range
      quickSelect
    />
  );
}

/* examples/datepicker/calendar-multiple-months-with-label.tsx — `Aa` is Uber's stand-in label,
 * there to show where a per-day label lands rather than to say anything. */
function CalendarMultipleMonthsWithLabelExample() {
  return (
    <StatefulCalendar
      onChange={({ date }) => console.log(date)}
      orientation={ORIENTATION.horizontal}
      monthsShown={2}
      range
      quickSelect
      dateLabel={() => `Aa`}
    />
  );
}

/* examples/datepicker/range-picker-with-separate-inputs.tsx */
function RangeDatepickerSeparateInputsExample() {
  return (
    <StatefulDatepicker
      aria-label="Select a date"
      clearable={true}
      initialState={{ value: [] }}
      highlightedDate={new Date('March 10, 2019')}
      range
      separateRangeInputs
    />
  );
}

/* examples/datepicker/composed-single-pickers.tsx */
const COMPOSED_SINGLE_DATE = new Date(2019, 3, 1, 12, 0, 0);

function ComposedSinglePickersExample() {
  const [css, theme] = useStyletron();
  const [date, setDate] = React.useState(COMPOSED_SINGLE_DATE);
  const [zone, setZone] = React.useState(null);

  return (
    <div className={css({ display: 'flex' })}>
      <div
        className={css({
          width: '120px',
          marginRight: theme.sizing.scale300,
        })}
      >
        <FormControl label="Date" caption="YYYY/MM/DD">
          <DatePicker
            value={date}
            onChange={({ date }) => setDate(date as Date)}
            timeSelectStart
          />
        </FormControl>
      </div>

      <div
        className={css({
          width: '120px',
          marginRight: theme.sizing.scale300,
        })}
      >
        <FormControl label="Time" caption="HH:MM">
          <TimePicker value={date} onChange={setDate as any} />
        </FormControl>
      </div>

      <div
        className={css({
          width: '340px',
        })}
      >
        <FormControl label="Timezone">
          <TimezonePicker
            date={date}
            value={zone ? (zone as any).id : undefined}
            onChange={setZone as any}
          />
        </FormControl>
      </div>
    </div>
  );
}

/* examples/datepicker/composed-range-pickers.tsx */
const COMPOSED_RANGE_START = new Date(2019, 3, 1, 12, 0, 0);
const COMPOSED_RANGE_END = new Date(2019, 3, 10, 16, 0, 0);

function ComposedRangePickersExample() {
  const [css, theme] = useStyletron();
  const [dates, setDates] = React.useState([COMPOSED_RANGE_START, COMPOSED_RANGE_END]);

  return (
    <div
      className={css({
        [theme.mediaQuery.medium]: {
          display: 'flex',
          alignItems: 'center',
        },
      })}
    >
      <div className={css({ display: 'flex' })}>
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale300,
          })}
        >
          <FormControl label="Start Date" caption="YYYY/MM/DD">
            <DatePicker
              value={dates}
              onChange={({ date }) => setDates(date as Array<Date>)}
              timeSelectStart
              range
              mask="9999/99/99"
              displayValueAtRangeIndex={0}
              placeholder="Start Date"
            />
          </FormControl>
        </div>

        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale300,
          })}
        >
          <FormControl label="Start Time" caption="HH:MM">
            <TimePicker
              value={dates[0]}
              onChange={(time) => {
                if (time) {
                  if (dates[1] && isAfter(time, dates[1])) {
                    setDates([time, time]);
                  } else {
                    setDates([time, dates[1]]);
                  }
                }
              }}
            />
          </FormControl>
        </div>
      </div>

      <div
        className={css({
          display: 'none',
          marginRight: theme.sizing.scale300,
          [theme.mediaQuery.medium]: {
            display: 'block',
          },
        })}
      >
        <ArrowRight size={24} />
      </div>

      <div className={css({ display: 'flex' })}>
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale300,
          })}
        >
          <FormControl label="End Date" caption="yyyy/MM/DD">
            <DatePicker
              value={dates}
              onChange={({ date }) => setDates(date as Array<Date>)}
              timeSelectEnd
              range
              mask="9999/99/99"
              displayValueAtRangeIndex={1}
              placeholder="End Date"
            />
          </FormControl>
        </div>

        <div
          className={css({
            width: '120px',
          })}
        >
          <FormControl label="End Time" caption="HH:MM">
            <TimePicker
              value={dates[1]}
              onChange={(time) => {
                if (time) {
                  if (dates[0] && isBefore(time, dates[0])) {
                    setDates([time, time]);
                  } else {
                    setDates([dates[0], time]);
                  }
                }
              }}
            />
          </FormControl>
        </div>
      </div>
    </div>
  );
}

/* examples/datepicker/datepickers-color-states.tsx — `positive` and `error` are Uber's own props
 * and they stay; the theme re-inks them, which is the point. */
function DatepickerColorStatesExample() {
  const [css, theme] = useStyletron();
  return (
    <React.Fragment>
      Disabled state
      <div
        className={css({
          display: 'flex',
        })}
      >
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="Datepicker">
            <StatefulDatePicker disabled />
          </FormControl>
        </div>
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="TimePicker">
            <TimePicker disabled />
          </FormControl>
        </div>
        <div className={css({ flex: 1 })}>
          <FormControl label="TimezonePicker">
            <TimezonePicker disabled />
          </FormControl>
        </div>
      </div>
      Positive state
      <div
        className={css({
          display: 'flex',
        })}
      >
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="Datepicker">
            <StatefulDatePicker positive />
          </FormControl>
        </div>
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="TimePicker">
            <TimePicker positive />
          </FormControl>
        </div>
        <div className={css({ flex: 1 })}>
          <FormControl label="TimezonePicker">
            <TimezonePicker positive />
          </FormControl>
        </div>
      </div>
      Error state
      <div
        className={css({
          display: 'flex',
        })}
      >
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="Datepicker">
            <StatefulDatePicker error />
          </FormControl>
        </div>
        <div
          className={css({
            width: '120px',
            marginRight: theme.sizing.scale500,
          })}
        >
          <FormControl label="TimePicker">
            <TimePicker error />
          </FormControl>
        </div>
        <div className={css({ flex: 1 })}>
          <FormControl label="TimezonePicker">
            <TimezonePicker error />
          </FormControl>
        </div>
      </div>
    </React.Fragment>
  );
}

/* examples/datepicker/datepicker-with-timezone.tsx */
function DatepickerWithTimezoneExample() {
  const [date, setDate] = React.useState(new Date());
  const [tz, setZone] = React.useState({
    id: 'America/Fort_Nelson',
    label: 'MST - America/Fort Nelson (GMT -07:00)',
    offset: 420,
  });

  return (
    <React.Fragment>
      <FormControl label="Date">
        <DatePicker
          onChange={({ date }) => setDate(date as Date)}
          value={date ? new Date(date.getTime() + tz.offset * 60000) : undefined}
        />
      </FormControl>
      <FormControl label="Timezone">
        <TimezonePicker date={date} onChange={setZone as any} />
      </FormControl>
    </React.Fragment>
  );
}

/* examples/datepicker/nested-override.tsx — THE ONE COLOUR EDIT IN THIS FILE. Uber's example
 * hard-codes `color: 'white', backgroundColor: 'salmon'` on the highlighted ListItem. Raw literals
 * bypass the theme, so they would paint a real salmon pink onto a page whose whole premise is that
 * colour is not a status system. They are the theme's own accent tokens here; the nested-override
 * mechanism being demonstrated is byte-for-byte Uber's. */
function DatepickerNestedOverrideExample() {
  const [singleDate, setSingleDate] = React.useState<Date | Date[]>([]);
  return (
    <DatePicker
      value={singleDate || null}
      onChange={({ date }) => setSingleDate(date as Date | Date[])}
      overrides={{
        // MonthYearSelectStatefulMenu is a Menu component
        // We can use any overrides available to Menu
        MonthYearSelectStatefulMenu: {
          props: {
            overrides: {
              ListItem: {
                style: ({
                  $theme,
                  $isHighlighted,
                }: {
                  $theme: any;
                  $isHighlighted: boolean;
                }) => {
                  return $isHighlighted
                    ? {
                        color: $theme.colors.contentInversePrimary,
                        backgroundColor: $theme.colors.backgroundAccent,
                      }
                    : null;
                },
              },
            },
          },
        },
        // Input override is the MaskedInput Base Web component.
        // We can use any overrides available to MaskedInput
        Input: {
          props: {
            overrides: {
              Input: {
                props: {
                  readonly: 'readonly',
                },
              },
            },
          },
        },
      }}
    />
  );
}

/* examples/datepicker/with-callback-overrides.tsx */
function DatepickerCallbackOverridesExample() {
  const [date, setDate] = React.useState(new Date('2020/01/01'));
  const [quickSelected, setQuickSelected] = React.useState('');

  return (
    <div>
      <LabelSmall>Quick Selected: {quickSelected || 'nothing'}</LabelSmall>
      <DatePicker
        value={date}
        onChange={({ date }) => setDate(date as Date)}
        quickSelect
        quickSelectOptions={[
          {
            id: 'suggested-time',
            beginDate: new Date(),
          },
          {
            id: 'other-time',
            beginDate: new Date(),
          },
        ]}
        overrides={{
          QuickSelectFormControl: {
            props: {
              overrides: {
                Label: () => <LabelSmall>{'Pick me!'}</LabelSmall>,
              },
            },
          },
          // @ts-ignore
          QuickSelect: ({ onChange, ...rest }) => (
            <Select
              // @ts-ignore
              onChange={(params: { option: { id: string } }) => {
                setQuickSelected(params.option.id);
                onChange(params); // call original
              }}
              {...rest}
            />
          ),
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TIME PICKER — two examples
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* examples/timepicker/timepicker.tsx */
function TimepickerExample() {
  const [css] = useStyletron();
  const [twelveHourTime, setTwelveHourTime] = React.useState<Date | null>(null);
  const [twentyFourHourTime, setTwentyFourHourTime] = React.useState<Date | null>(null);
  const [creatableTime, setCreatableTime] = React.useState<Date | null>(null);

  return (
    <div className={css({ width: '130px' })}>
      <FormControl label="12 hour format">
        <TimePicker value={twelveHourTime} onChange={setTwelveHourTime} />
      </FormControl>
      <FormControl label="24 hour format">
        <TimePicker
          value={twentyFourHourTime}
          onChange={setTwentyFourHourTime}
          format="24"
          step={1800}
        />
      </FormControl>
      <FormControl label="Creatable times">
        <TimePicker value={creatableTime} onChange={setCreatableTime} creatable step={900} />
      </FormControl>
    </div>
  );
}

/* examples/timepicker/timepicker-minmax.tsx */
const TIMEPICKER_INITIAL = new Date('December 6, 2021 9:00:00');
const TIMEPICKER_SAME_DATE_MIN = new Date('December 6, 2021 8:00:00');
const TIMEPICKER_SAME_DATE_MAX = new Date('December 6, 2021 10:00:00');
const TIMEPICKER_BEYOND_DATE_MIN = new Date('December 4, 2021 8:00:00');
const TIMEPICKER_BEYOND_DATE_MAX = new Date('December 8, 2021 10:00:00');

function TimepickerMinMaxExample() {
  const [css] = useStyletron();
  const [sameDate, setSameDate] = React.useState(TIMEPICKER_INITIAL);
  const [clampDate, setClampDate] = React.useState(TIMEPICKER_INITIAL);
  const [ignoreDate, setIgnoreDate] = React.useState(TIMEPICKER_INITIAL);

  return (
    <div className={css({ width: '130px' })}>
      <FormControl label="min/max times on the same date">
        <TimePicker
          value={sameDate}
          minTime={TIMEPICKER_SAME_DATE_MIN}
          maxTime={TIMEPICKER_SAME_DATE_MAX}
          onChange={setSameDate as any}
        />
      </FormControl>

      <FormControl label="min/max times beyond value date clamp to date start/end">
        <TimePicker
          value={clampDate}
          minTime={TIMEPICKER_BEYOND_DATE_MIN}
          maxTime={TIMEPICKER_BEYOND_DATE_MAX}
          onChange={setClampDate as any}
        />
      </FormControl>

      <FormControl label="min/max times can also ignore the date components">
        <TimePicker
          ignoreMinMaxDateComponent
          value={ignoreDate}
          minTime={TIMEPICKER_BEYOND_DATE_MIN}
          maxTime={TIMEPICKER_BEYOND_DATE_MAX}
          onChange={setIgnoreDate as any}
        />
      </FormControl>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TIMEZONE PICKER — one example
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* examples/timezonepicker/timezone-picker.tsx — the two dates are Uber's own: they straddle a
 * daylight-savings boundary, which is what the example exists to show. */
function TimezonePickerExample() {
  const [css] = useStyletron();
  return (
    <div className={css({ width: '400px' })}>
      <FormControl label="daylight savings time">
        <TimezonePicker date={new Date(2019, 3, 1)} />
      </FormControl>
      <FormControl label="standard time">
        <TimezonePicker date={new Date(2019, 2, 1)} />
      </FormControl>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function TimeSection() {
  return (
    <React.Fragment>
      <Section
        t="Datepicker"
        n="Work with, or select, a single date or a range of dates."
      >
        <Grid>
          <Tile name="Datepicker basic usage" span={6}>
            <DatepickerBasicExample />
          </Tile>
          <Tile name="Datepicker in a popover" span={4}>
            <DatepickerInPopoverExample />
          </Tile>
          <Tile name="Datepicker with quick select actions" span={6}>
            <DatepickerQuickSelectExample />
          </Tile>
          <Tile
            name="Datepicker with localization"
            rule="formatString takes any date-fns pattern; some patterns need the locale object too."
            span={4}
          >
            <DatepickerI18nExample />
          </Tile>
          <Tile name="Datepicker with overrides" span={6}>
            <DatepickerWithOverridesExample />
          </Tile>
          <Tile
            name="Datepicker with custom mask"
            rule="A custom mask wants a formatString that matches it."
            span={4}
          >
            <DatepickerWithMaskExample />
          </Tile>
          <Tile
            name="Datepicker with no mask"
            rule="Some date formats read better free of the input mask — pass null to release it."
            span={4}
          >
            <DatepickerNullMaskExample />
          </Tile>
          <Tile name="Calendar with time select actions" span={6}>
            <CalendarTimeSelectExample />
          </Tile>
          <Tile name="Calendar with multiple months" span={12}>
            <CalendarMultipleMonthsExample />
          </Tile>
          <Tile name="Calendar with multiple months and labels" span={12}>
            <CalendarMultipleMonthsWithLabelExample />
          </Tile>
          <Tile name="Range Datepicker with Separate Inputs" span={6}>
            <RangeDatepickerSeparateInputsExample />
          </Tile>
          <Tile name="Composed single pickers" span={12}>
            <ComposedSinglePickersExample />
          </Tile>
          <Tile name="Composed range pickers" span={12}>
            <ComposedRangePickersExample />
          </Tile>
          <Tile name="Datepicker states" span={12}>
            <DatepickerColorStatesExample />
          </Tile>
          <Tile
            name="Datepicker with timezone selection"
            rule="Covers most cases; for mission-critical data pass a date object from a timezone-aware library."
            span={6}
          >
            <DatepickerWithTimezoneExample />
          </Tile>
          <Tile
            name="Overriding a nested component"
            rule="A nested override reaches the ListItem inside MonthYearSelectStatefulMenu."
            span={4}
          >
            <DatepickerNestedOverrideExample />
          </Tile>
          <Tile
            name="Overriding and watching nested component callback"
            rule="Replacing the whole subcomponent lets you wrap its onChange and still call the original."
            span={6}
          >
            <DatepickerCallbackOverridesExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Time Picker"
        n="Pick a time of day from stepped options, in 12- or 24-hour format."
      >
        <Grid>
          <Tile name="Timepicker" span={4}>
            <TimepickerExample />
          </Tile>
          <Tile name="Timepicker Min/Max Times" span={4}>
            <TimepickerMinMaxExample />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Timezone Picker"
        n="Pick a timezone from the IANA database; the options offered are the ones that apply on the date you give it."
      >
        <Grid>
          <Tile name="Timezone picker" span={6}>
            <TimezonePickerExample />
          </Tile>
        </Grid>
      </Section>
    </React.Fragment>
  );
}
