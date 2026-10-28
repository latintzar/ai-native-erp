/* FEEDBACK — Base Web's own examples, running under the Rocoto theme.
 *
 * Thirteen components ship here, in the order the kit reads them: Spinner, Skeleton, ProgressBar,
 * ProgressSteps, Snackbar, Toast, Notification, Banner, SystemBanner, MessageCard, EmptyState,
 * HintDot, NotificationCircle. Every example file under bw-docs/examples/{spinner,skeleton,
 * progress-bar,progress-steps,snackbar,toast,notification,banner,system-banner,message-card,
 * empty-state,hint-dot,notification-circle} becomes one Tile — 52 of them. Nothing is dropped,
 * including the three system-banner examples the docs page buries under "Usage patterns" rather
 * than in its Examples list (clickable-banner, multiple-actions, with-icons), and including
 * spinner/custom.tsx and progress-bar/negative.tsx, which the mdx renders below the fold.
 *
 * The demo copy is Uber's own, verbatim — the kit is grammar, not sentences, and a themed demo
 * would pre-decide which control serves which moment of the product. That decision belongs to the
 * situations catalogue, later and explicitly.
 *
 * The edits to Uber's code are two, and only two:
 *   (a) docs-site-local imports become real ones — the example files' relative `./images/*.jpg`
 *       become `new URL(..., import.meta.url)` against the same files in bw-docs, so the message
 *       cards run on Uber's own photography rather than a substitute;
 *   (b) names are made unique so all fifty-two can share one module. Three helpers that Uber
 *       repeats verbatim across files — `useInterval` (five copies across progress-bar) and
 *       `SpacedButton` (three copies across progress-steps) — appear once here, unchanged; five
 *       identical copies in one module is a collision, not a demonstration. Likewise the `KIND`,
 *       `SIZE`, `COLOR` and `PLACEMENT` constants collide across seven packages, so each import
 *       is aliased and the example bodies use the alias.
 *
 * COLOUR: the theme re-inks. `kind={KIND.negative}`, `intent={INTENT.warning}`, the traffic light
 * on Toast and Banner and SystemBanner — all of it stays exactly as Uber wrote it and all of it
 * comes out INK, because negative/warning/positive collapse onto ink in this theme and colour is
 * not a status system here. That is the demonstration working. Where an example hard-codes a
 * colour OUTSIDE the theme's reach — `borderTopColor: 'pink'` on the custom spinner, the blue
 * button on the clickable banner, the mint glass fill and the orange gradient in the
 * style-overrides banner, the yellow/green status panels under multiple-actions — the theme
 * cannot re-ink it, so the value is re-sourced from the theme. Marked ↯ at each site; the value
 * Uber wrote is named in words, and the digits stay where they belong, in bw-docs/examples.
 * The MessageCard palette is the exception that stays: `colors.teal200` and friends come from
 * `baseui/tokens`, and the whole point of that example is that MessageCard picks a legible text
 * colour against an arbitrary primitive. Re-inking them would delete the demonstration.
 *
 * CORNERS AND DATA: every radius reads `theme.borders.radius100–500`, so the corner knob in the
 * BRAND block moves them all. Two kinds of literal survive, each carrying `// theme-gate-allow`
 * as its audit trail: the pill (`9999px` — a shape, like `50%`, identical under any brand), and
 * hexes that are DATA rather than paint (the colour-name options in the progress-steps select,
 * whose hex is the option's value and is never painted; and the arbitrary dark background the
 * custom-color MessageCard exists to demonstrate).
 *
 * ONE TOASTER, THREE EXAMPLES: `toaster` holds a single module-level ref, so with three
 * ToasterContainers mounted on one page the last one mounted receives every toast. That is what
 * happens on Uber's own docs page, which mounts the same three, so the three examples ship as
 * written rather than being merged into one.
 *
 * VERSION NOTE — ProgressBar intent: bw-docs/examples/progress-bar/intent.tsx is written against
 * a Base newer than the pinned baseui@16.1.1, which ships neither the `INTENT` export nor the
 * `intent` prop. Rather than move the whole page onto a later major mid-build, the mapping is
 * reproduced here from Uber's own source (bw-src/src/progress-bar/styled-components.tsx,
 * `getProgressColor`) and applied through overrides on BarProgress and InfiniteBar — the same
 * five theme colours the shipped prop would resolve to. See the block marked VERSION SHIM.
 */
import * as React from 'react';
import { Section, Tile, Grid } from '../chrome';

import { useStyletron, withStyle } from 'baseui';

import { Spinner, SIZE as SpinnerSize } from 'baseui/spinner';
import { Skeleton } from 'baseui/skeleton';
import { ProgressBar, ProgressBarRounded } from 'baseui/progress-bar';
import { ProgressSteps, Step, NumberedStep, ORIENTATION } from 'baseui/progress-steps';
import {
  SnackbarProvider,
  SnackbarElement,
  useSnackbar,
  DURATION,
  PLACEMENT as SNACKBAR_PLACEMENT,
} from 'baseui/snackbar';
import type { Placement } from 'baseui/snackbar';
import { Toast, ToasterContainer, toaster, KIND as TOAST_KIND } from 'baseui/toast';
import { Notification, KIND as NOTIFICATION_KIND } from 'baseui/notification';
import { Banner, ACTION_POSITION, ARTWORK_TYPE, HIERARCHY, KIND as BANNER_KIND } from 'baseui/banner';
import { SystemBanner } from 'baseui/system-banner';
import { MessageCard, IMAGE_LAYOUT, BACKGROUND_COLOR_TYPE, BUTTON_KIND } from 'baseui/message-card';
import { HintDot, NotificationCircle, COLOR as BADGE_COLOR, PLACEMENT as BADGE_PLACEMENT } from 'baseui/badge';

import { Button, KIND as BUTTON_KIND_BASE, SIZE as BUTTON_SIZE, SHAPE } from 'baseui/button';
import type { ButtonProps } from 'baseui/button';
import { Block } from 'baseui/block';
import { Tag, SIZE as TAG_SIZE } from 'baseui/tag';
import { StatefulSelect, Select, TYPE } from 'baseui/select';
import { FormControl } from 'baseui/form-control';
import { colors } from 'baseui/tokens';
import { expandBorderStyles } from 'baseui/styles';
import { Alert, Check, ChevronRight, Delete, DeleteAlt, Hide, Search, Upload } from 'baseui/icon';

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SHARED HELPERS — Uber's own, lifted out of the files that each carry a copy.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* progress-bar/*.tsx — five files carry this verbatim.
 * https://overreacted.io/making-setinterval-declarative-with-react-hooks/ */
function useInterval(callback: () => void, delay: number | null) {
  const savedCallback = React.useRef(() => {});

  // Remember the latest callback.
  React.useEffect(() => {
    savedCallback.current = callback;
  }, [callback]);

  // Set up the interval.
  React.useEffect((): any => {
    function tick() {
      savedCallback.current();
    }
    if (delay !== null) {
      let id = setInterval(tick, delay);
      return () => clearInterval(id);
    }
  }, [delay]);
}

/* progress-steps/{dotted,numbered,horizontal}.tsx — three files carry this verbatim. */
function SpacedButton(props: ButtonProps) {
  return (
    <Button
      {...props}
      shape={SHAPE.pill}
      kind={BUTTON_KIND_BASE.secondary}
      size={BUTTON_SIZE.compact}
      overrides={{
        BaseButton: {
          style: ({ $theme }) => ({
            marginLeft: $theme.sizing.scale200,
            marginRight: $theme.sizing.scale200,
            marginTop: $theme.sizing.scale800,
          }),
        },
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SPINNER — bw-docs/examples/spinner/*.tsx (4 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* spinner/basic.tsx */
function SpinnerBasic() {
  return <Spinner />;
}

/* spinner/size.tsx */
function SpinnerSizes() {
  return (
    <React.Fragment>
      <Spinner $size={SpinnerSize.small} />
      <Spinner $size={SpinnerSize.medium} /> {/* Default */}
      <Spinner $size={SpinnerSize.large} />
    </React.Fragment>
  );
}

/* spinner/span.tsx */
function SpinnerSpan() {
  return (
    <p>
      <Spinner $as="span" />
    </p>
  );
}

/* spinner/custom.tsx — ↯ Uber's `borderTopColor: 'pink'` is outside the theme's reach, so the
 * highlight is re-sourced from the theme. It resolves to saffron: the spinner is Rocoto working,
 * and saffron marks Rocoto's own act. The four border widths and the 96px box are Uber's. */
const ExtraLargeSpinner = withStyle<typeof Spinner, {}>(Spinner, ({ $theme }) => ({
  width: '96px',
  height: '96px',
  borderLeftWidth: '12px',
  borderRightWidth: '12px',
  borderTopWidth: '12px',
  borderBottomWidth: '12px',
  borderTopColor: $theme.colors.contentAccent,
}));

function SpinnerCustom() {
  return <ExtraLargeSpinner />;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SKELETON — bw-docs/examples/skeleton/*.tsx (5 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* skeleton/basic.tsx */
function SkeletonBasic() {
  return <Skeleton height="100px" width="200px" />;
}

/* skeleton/auto-size-rows.tsx */
function SkeletonAutoSizeRows() {
  return <Skeleton autoSizeRows rows={3} height="100px" width="200px" />;
}

/* skeleton/circle.tsx */
function SkeletonCircle() {
  return (
    <Skeleton
      width="100px"
      height="100px"
      overrides={{
        Root: {
          style: {
            borderRadius: '50%',
          },
        },
      }}
    />
  );
}

/* skeleton/animation.tsx */
function SkeletonAnimation() {
  return <Skeleton width="200px" height="100px" animation />;
}

/* skeleton/subElements.tsx */
function SkeletonSubElements() {
  return (
    <Skeleton
      rows={3}
      width="200px"
      overrides={{
        Row: {
          style: {
            height: '20px',
            marginBottom: '15px',
          },
        },
      }}
    />
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * PROGRESS BAR — bw-docs/examples/progress-bar/*.tsx (8 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* progress-bar/basic.tsx */
function ProgressBarBasic() {
  const [value, setValue] = React.useState(0);
  useInterval(() => {
    if (value < 100) {
      setValue(value + 10);
    } else {
      setValue(0);
    }
  }, 1000);

  return <ProgressBar value={value} />;
}

/* progress-bar/negative.tsx */
function ProgressBarNegative() {
  const [value, setValue] = React.useState(0);
  useInterval(() => {
    if (value < 100) {
      setValue(value + 10);
    } else {
      setValue(0);
    }
  }, 1000);

  return (
    <ProgressBar
      value={value}
      overrides={{
        BarProgress: {
          style: ({ $theme }) => ({
            backgroundColor: $theme.colors.negative,
          }),
        },
      }}
    />
  );
}

/* progress-bar/intent.tsx — VERSION SHIM.
 * baseui@16.1.1 ships neither `INTENT` nor the `intent` prop; both land in a later major. The
 * constant and the colour mapping below are Uber's own, copied from bw-src/src/progress-bar/
 * {constants.ts, styled-components.tsx}, and applied through the overrides the pinned version
 * does have. Everything the shipped prop would resolve to resolves the same way here — which,
 * under this theme, means four of the five come out ink and `brand` comes out saffron. */
const INTENT = {
  default: 'default',
  positive: 'positive',
  warning: 'warning',
  negative: 'negative',
  brand: 'brand',
} as const;

type Intent = keyof typeof INTENT;

function intentOverrides(intent: Intent) {
  const color = ({ $theme }: { $theme: any }) =>
    ({
      [INTENT.default]: $theme.colors.contentAccent,
      [INTENT.positive]: $theme.colors.contentPositive,
      [INTENT.warning]: $theme.colors.contentWarning,
      [INTENT.negative]: $theme.colors.contentNegative,
      [INTENT.brand]: $theme.colors.brandBorderAccessible,
    }[intent]);

  return {
    BarProgress: { style: (props: { $theme: any }) => ({ backgroundColor: color(props) }) },
    InfiniteBar: { style: (props: { $theme: any }) => ({ backgroundColor: color(props) }) },
  };
}

function ProgressBarIntent() {
  return (
    <>
      <ProgressBar value={50} showLabel overrides={intentOverrides(INTENT.positive)} />
      <br />
      <ProgressBar value={50} showLabel overrides={intentOverrides(INTENT.warning)} />
      <br />
      <ProgressBar value={50} showLabel overrides={intentOverrides(INTENT.negative)} />
      <br />
      <ProgressBar value={50} showLabel overrides={intentOverrides(INTENT.brand)} />
      <br />
      <ProgressBar infinite showLabel overrides={intentOverrides(INTENT.positive)} />
    </>
  );
}

/* progress-bar/with-label.tsx */
function ProgressBarWithLabel() {
  const [value, setValue] = React.useState(0);
  useInterval(() => {
    if (value < 100) {
      setValue(value + 10);
    } else {
      setValue(0);
    }
  }, 1000);

  return <ProgressBar value={value} showLabel />;
}

/* progress-bar/custom-label.tsx */
const MAX_MB_VALUE = 1000;

function ProgressBarCustomLabel() {
  const [value, setValue] = React.useState(0);
  useInterval(() => {
    if (value < 100) {
      setValue(value + 10);
    } else {
      setValue(0);
    }
  }, 1000);

  return (
    <ProgressBar
      value={value}
      getProgressLabel={(value) =>
        `${(MAX_MB_VALUE / 100) * value}mb out of ${MAX_MB_VALUE}mb downloaded`
      }
      showLabel
    />
  );
}

/* progress-bar/overrides.tsx */
function ProgressBarOverrides() {
  const [value, setValue] = React.useState(0);
  useInterval(() => {
    if (value < 100) {
      setValue(value + 10);
    } else {
      setValue(0);
    }
  }, 1000);

  return (
    <ProgressBar
      value={value}
      overrides={{
        BarProgress: {
          style: ({ $theme, $value }) => {
            return {
              ...$theme.typography.font350,
              backgroundColor: $theme.colors.positive,
              color: $theme.colors.mono200,
              position: 'relative',
              ':after': {
                position: 'absolute',
                content: $value > 5 ? `"${$value}%"` : '',
                right: '10px',
              },
            };
          },
        },
        Bar: {
          style: ({ $theme }) => ({
            height: $theme.sizing.scale800,
          }),
        },
      }}
    />
  );
}

/* progress-bar/steps.tsx */
function ProgressBarSteps() {
  const STEPS = 5;
  const stepSize = 100 / STEPS;
  const [value, setValue] = React.useState(50);
  return (
    <div>
      <ProgressBar value={value} steps={5} />
      <div style={{ display: 'flex', justifyContent: 'center', marginTop: '10px' }}>
        <Button
          onClick={() => setValue((prevValue) => prevValue - stepSize)}
          size={BUTTON_SIZE.compact}
          disabled={value === 0 || value === 100}
          overrides={{
            BaseButton: {
              style: { width: '116px', marginRight: '20px' },
            },
          }}
        >
          Previous Step
        </Button>
        <Button
          onClick={() => setValue((prevValue) => prevValue + stepSize)}
          size={BUTTON_SIZE.compact}
          disabled={value === 100}
          overrides={{ BaseButton: { style: { width: '116px' } } }}
        >
          {value >= 80 ? 'Complete' : 'Next Step'}
        </Button>
      </div>
    </div>
  );
}

/* progress-bar/rounded.tsx */
function ProgressBarRoundedBasic() {
  const [progress, setProgress] = React.useState(0);

  useInterval(() => {
    if (progress < 1) {
      setProgress(progress + 0.1);
    } else {
      setProgress(0);
    }
  }, 1000);

  return <ProgressBarRounded progress={progress} />;
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * PROGRESS STEPS — bw-docs/examples/progress-steps/*.tsx (3 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* progress-steps/dotted.tsx */
function ProgressStepsDotted() {
  const [current, setCurrent] = React.useState(0);
  const [css, theme] = useStyletron();

  return (
    <ProgressSteps current={current}>
      <Step title="Create Account">
        <div
          className={css({
            ...theme.typography.ParagraphSmall,
            marginBottom: '24px',
          })}
        >
          Here is some step content
        </div>
        <StatefulSelect
          options={[
            /* Uber's stock option list. Each hex is the option's VALUE (`valueKey="color"`),
             * shown as text and never painted — it is data the select carries, not brand. */
            { id: 'AliceBlue', color: '#F0F8FF' }, // theme-gate-allow: select option data, never painted
            { id: 'AntiqueWhite', color: '#FAEBD7' }, // theme-gate-allow: select option data, never painted
            { id: 'Aqua', color: '#00FFFF' }, // theme-gate-allow: select option data, never painted
            { id: 'Aquamarine', color: '#7FFFD4' }, // theme-gate-allow: select option data, never painted
            { id: 'Azure', color: '#F0FFFF' }, // theme-gate-allow: select option data, never painted
            { id: 'Beige', color: '#F5F5DC' }, // theme-gate-allow: select option data, never painted
          ]}
          labelKey="id"
          valueKey="color"
          placeholder="Choose a color"
          maxDropdownHeight="300px"
          type={TYPE.search}
          onChange={(event) => console.log(event)}
        />
        <SpacedButton disabled>Previous</SpacedButton>
        <SpacedButton onClick={() => setCurrent(1)}>Next</SpacedButton>
      </Step>
      <Step title="Verify Payment">
        <div className={css({ ...theme.typography.ParagraphSmall })}>
          Here is some more content
        </div>
        <SpacedButton onClick={() => setCurrent(0)}>Previous</SpacedButton>
        <SpacedButton onClick={() => setCurrent(2)}>Next</SpacedButton>
      </Step>
      <Step title="Add Payment Method">
        <div className={css({ ...theme.typography.ParagraphSmall })}>Here too!</div>
        <SpacedButton onClick={() => setCurrent(1)}>Previous</SpacedButton>
        <SpacedButton disabled>Next</SpacedButton>
      </Step>
    </ProgressSteps>
  );
}

/* progress-steps/numbered.tsx */
function ProgressStepsNumbered() {
  const [current, setCurrent] = React.useState(0);
  const [css, theme] = useStyletron();
  return (
    <ProgressSteps current={current}>
      <NumberedStep title="Create Account">
        <div className={css({ ...theme.typography.ParagraphSmall })}>
          Here is some step content
        </div>
        <SpacedButton disabled>Previous</SpacedButton>
        <SpacedButton onClick={() => setCurrent(1)}>Next</SpacedButton>
      </NumberedStep>
      <NumberedStep title="Verify Payment">
        <div className={css({ ...theme.typography.ParagraphSmall })}>
          Here is some more content
        </div>
        <SpacedButton onClick={() => setCurrent(0)}>Previous</SpacedButton>
        <SpacedButton onClick={() => setCurrent(2)}>Next</SpacedButton>
      </NumberedStep>
      <NumberedStep title="Add Payment Method">
        <div className={css({ ...theme.typography.ParagraphSmall })}>Here too!</div>
        <SpacedButton onClick={() => setCurrent(1)}>Previous</SpacedButton>
        <SpacedButton disabled>Next</SpacedButton>
      </NumberedStep>
    </ProgressSteps>
  );
}

/* progress-steps/horizontal.tsx */
function ProgressStepsHorizontal() {
  const [current, setCurrent] = React.useState(0);
  return (
    <ProgressSteps current={current} orientation={ORIENTATION.horizontal}>
      <NumberedStep title="Create Account">
        <SpacedButton disabled>Previous</SpacedButton>
        <SpacedButton onClick={() => setCurrent(1)}>Next</SpacedButton>
      </NumberedStep>
      <NumberedStep title="Verify Payment">
        <SpacedButton onClick={() => setCurrent(0)}>Previous</SpacedButton>
        <SpacedButton onClick={() => setCurrent(2)}>Next</SpacedButton>
      </NumberedStep>
      <NumberedStep title="Add Payment Method">
        <SpacedButton onClick={() => setCurrent(1)}>Previous</SpacedButton>
        <SpacedButton disabled>Next</SpacedButton>
      </NumberedStep>
    </ProgressSteps>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SNACKBAR — bw-docs/examples/snackbar/*.tsx (4 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* snackbar/line-lengths.tsx */
function SnackbarLineLengthsChild() {
  const { enqueue } = useSnackbar();

  return (
    <div>
      <Button
        onClick={() =>
          enqueue({
            message: 'Copied to clipboard',
            startEnhancer: ({ size }) => <Check size={size} />,
          })
        }
      >
        one line
      </Button>

      <br />
      <br />

      <Button
        onClick={() =>
          enqueue(
            {
              message:
                '1455 Market Street San Francisco was set as your default work address',
              startEnhancer: ({ size }) => <Check size={size} />,
            },
            DURATION.medium
          )
        }
      >
        two lines
      </Button>

      <br />
      <br />

      <Button
        onClick={() =>
          enqueue(
            {
              message:
                'Perferendis dolorem quam velit. Numquam iusto nisi sit quisquam incidunt veritatis ex perspiciatis. Minima pariatur molestiae architecto. Doloremque beatae',
            },
            DURATION.long
          )
        }
      >
        three lines
      </Button>
    </div>
  );
}

function SnackbarLineLengths() {
  return (
    <SnackbarProvider>
      <SnackbarLineLengthsChild />
    </SnackbarProvider>
  );
}

/* snackbar/infinite-duration.tsx */
function SnackbarInfiniteDurationChild() {
  const { enqueue, dequeue } = useSnackbar();
  const [downloadCountdown, setDownloadCountdown] = React.useState(-1);

  function clearDownloadCountdown() {
    setDownloadCountdown(-1);
  }

  React.useEffect(() => {
    if (downloadCountdown === 0) {
      clearDownloadCountdown();
      dequeue();
      enqueue({ message: 'Download complete' });
    } else if (downloadCountdown > 0) {
      setTimeout(() => {
        setDownloadCountdown((prev) => prev - 1);
      }, 1000);
    }
  }, [downloadCountdown]);

  return (
    <div>
      <Button
        onClick={() => {
          if (downloadCountdown <= -1) {
            setDownloadCountdown(5);
            enqueue(
              {
                message: 'Downloading file to your device',
                progress: true,
                actionMessage: 'Cancel',
                actionOnClick: () => {
                  clearDownloadCountdown();
                  enqueue({ message: 'Download canceled' });
                },
              },
              DURATION.infinite
            );
          }
        }}
      >
        Download file
      </Button>

      {downloadCountdown > 0 && <p>Download completing in {downloadCountdown}</p>}
    </div>
  );
}

function SnackbarInfiniteDuration() {
  return (
    <SnackbarProvider>
      <SnackbarInfiniteDurationChild />
    </SnackbarProvider>
  );
}

/* snackbar/placement.tsx */
const placementOptions = (Object.keys(SNACKBAR_PLACEMENT) as Array<Placement>).map((key) => {
  return { label: SNACKBAR_PLACEMENT[key], id: SNACKBAR_PLACEMENT[key] };
});

function SnackbarPlacementChild({ placement }: { placement: string }) {
  const { enqueue } = useSnackbar();
  return (
    <div>
      <Button onClick={() => enqueue({ message: placement })}>Enqueue {placement}</Button>
    </div>
  );
}

function SnackbarPlacement() {
  const [css] = useStyletron();
  const [placement, setPlacement] = React.useState<Placement>(SNACKBAR_PLACEMENT.top);

  return (
    <div className={css({ width: '320px' })}>
      <SnackbarProvider placement={placement}>
        <FormControl label="Choose placement">
          <Select
            options={placementOptions}
            onChange={({ value }) => setPlacement(value[0].id as Placement)}
            value={[{ id: placement }]}
            clearable={false}
          />
        </FormControl>
        <SnackbarPlacementChild placement={placement} />
      </SnackbarProvider>
    </div>
  );
}

/* snackbar/action-button-usage.tsx */
// See examples above for how to enqueue these snackbars at the top of page
function SnackbarActionButtonUsage() {
  const [css] = useStyletron();
  return (
    <div>
      <div className={css({ paddingBottom: '24px' })}>
        <SnackbarElement
          progress
          message="Downloading your file"
          actionMessage="Cancel"
          actionOnClick={() => {
            // handle cancel
          }}
          focus={false}
        />
      </div>

      <div className={css({ paddingBottom: '24px' })}>
        <SnackbarElement
          startEnhancer={({ size }) => <Delete size={size} title="" />}
          message="The address was removed from your saved places"
          actionMessage="Undo"
          actionOnClick={() => {
            // handle undo
          }}
          focus={false}
        />
      </div>

      <div className={css({ paddingBottom: '24px' })}>
        <SnackbarElement
          startEnhancer={({ size }) => <Check size={size} title="" />}
          message="The address was added to your saved places"
          actionMessage="See list"
          actionOnClick={() => {
            // handle see list
          }}
          focus={false}
        />
      </div>

      <div className={css({ paddingBottom: '24px' })}>
        <SnackbarElement
          startEnhancer={({ size }) => <DeleteAlt size={size} title="" />}
          message="Your address wasn't added"
          actionMessage="Try again"
          actionOnClick={() => {
            // handle try again
          }}
          focus={false}
        />
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * TOAST — bw-docs/examples/toast/*.tsx (3 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* toast/toast-notification.tsx — all four kinds ship. Under this theme all four come out ink. */
function ToastNotification() {
  return (
    <React.Fragment>
      <ToasterContainer />
      <Toast>Default info notification</Toast>
      <Toast kind={TOAST_KIND.positive}>Positive notification</Toast>
      <Toast kind={TOAST_KIND.warning}>Warning notification</Toast>
      <Toast kind={TOAST_KIND.negative}>Negative notification</Toast>
    </React.Fragment>
  );
}

/* toast/toast-same-key-notification.tsx */
function ToastSameKeyNotification() {
  const [count, setCount] = React.useState(0);
  return (
    <React.Fragment>
      <ToasterContainer />
      <Button
        onClick={() => {
          setCount(count + 1);
          let toastKey: React.Key = '';
          const msg = `Click count: ${count}`;
          const ok = (
            <Block marginTop="15px" display="flex" justifyContent="center">
              <Button size={BUTTON_SIZE.compact} onClick={() => toaster.clear(toastKey)}>
                Ok
              </Button>
            </Block>
          );
          const showMore = (
            <Block marginTop="15px" display="flex" justifyContent="center">
              <Button
                size={BUTTON_SIZE.compact}
                onClick={() =>
                  toaster.update(toastKey, {
                    children: (
                      <React.Fragment>
                        {msg} button clicks have been detected. {ok}
                      </React.Fragment>
                    ),
                  })
                }
              >
                Show more
              </Button>
            </Block>
          );
          const toastMethods = [
            toaster.info,
            toaster.negative,
            toaster.positive,
            toaster.warning,
          ];
          const toastMethod = toastMethods[count % 4];
          toastKey = toastMethod.call(
            toaster,
            <React.Fragment>
              {msg}
              {showMore}
            </React.Fragment>,
            {
              key: 'same-key',
              onClose: () => console.log('Toast closed.'),
              overrides: {
                InnerContainer: {
                  style: { width: '100%' },
                },
              },
            }
          );
        }}
      >
        Show notification
      </Button>
    </React.Fragment>
  );
}

/* toast/toast-close-from-outside.tsx — ↯ Uber's alias is `React.ReactText | null`; on the pinned
 * @types/react, `toaster.info` returns `React.Key`, which is wider (it admits bigint). The alias
 * is widened to match so the demonstration compiles as written. */
type INullableReactText = React.Key | null;

function ToastCloseFromOutside() {
  const [toastKey, setToastKey] = React.useState<INullableReactText>(null);

  const showToast = () =>
    setToastKey(toaster.info('This is the message.', {}));

  const closeToast = () => {
    if (toastKey) {
      toaster.clear(toastKey);
      setToastKey(null);
    }
  };

  return (
    <React.Fragment>
      <ToasterContainer />
      <Button onClick={showToast}>Show notification</Button>
      <Button disabled={!toastKey} onClick={closeToast}>
        Close notification
      </Button>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * NOTIFICATION — bw-docs/examples/notification/*.tsx (6 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* notification/basic.tsx */
function NotificationBasic() {
  return <Notification>Default info notification</Notification>;
}

/* notification/kinds.tsx */
function NotificationKinds() {
  return (
    <React.Fragment>
      <Notification kind={NOTIFICATION_KIND.positive}>Positive notification</Notification>
      <Notification kind={NOTIFICATION_KIND.warning}>Warning notification</Notification>
      <Notification kind={NOTIFICATION_KIND.negative}>Negative notification</Notification>
    </React.Fragment>
  );
}

/* notification/closeable.tsx */
function NotificationCloseable() {
  return <Notification closeable>Closeable notification</Notification>;
}

/* notification/full-width.tsx */
function NotificationFullWidth() {
  return (
    <Notification
      overrides={{
        Body: { style: { width: 'auto' } },
      }}
    >
      Default info notification
    </Notification>
  );
}

/* notification/overrides.tsx */
function NotificationOverrides() {
  return (
    <Notification
      overrides={{
        Body: {
          style: ({ $theme }) => ({
            ...expandBorderStyles($theme.borders.border600),
          }),
        },
        CloseIcon: {
          component: DeleteAlt as React.FC<any>,
          style: { float: 'right', cursor: 'pointer' },
        },
      }}
      closeable
    >
      Notification with overrides
    </Notification>
  );
}

/* notification/custom-dismiss.tsx */
function NotificationCustomDismiss() {
  return (
    <Notification>
      {({ dismiss }) => (
        <Button onClick={dismiss} size={BUTTON_SIZE.compact}>
          Dismiss
        </Button>
      )}
    </Notification>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * BANNER — bw-docs/examples/banner/*.tsx (3 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* banner/variants.tsx — the paragraph repeats on purpose: eight banners, one sentence, so the
 * only thing that varies is the colour pair. Under this theme every pair is ink on paper. */
function BannerVariants() {
  const [css] = useStyletron();
  return (
    <div className={css({ width: '400px' })}>
      <Banner hierarchy={HIERARCHY.low} kind={BANNER_KIND.info}>
        Paragraph text
      </Banner>
      <Banner hierarchy={HIERARCHY.low} kind={BANNER_KIND.positive}>
        Paragraph text
      </Banner>
      <Banner hierarchy={HIERARCHY.low} kind={BANNER_KIND.negative}>
        Paragraph text
      </Banner>
      <Banner hierarchy={HIERARCHY.low} kind={BANNER_KIND.warning}>
        Paragraph text
      </Banner>

      <Banner hierarchy={HIERARCHY.high} kind={BANNER_KIND.info}>
        Paragraph text
      </Banner>
      <Banner hierarchy={HIERARCHY.high} kind={BANNER_KIND.positive}>
        Paragraph text
      </Banner>
      <Banner hierarchy={HIERARCHY.high} kind={BANNER_KIND.negative}>
        Paragraph text
      </Banner>
      <Banner hierarchy={HIERARCHY.high} kind={BANNER_KIND.warning}>
        Paragraph text
      </Banner>
    </div>
  );
}

/* banner/artwork.tsx */
function BannerArtworkIcon({ size }: { size: string }) {
  return <DeleteAlt size={size} aria-label="icon label" />;
}

function BannerArtwork() {
  const [css] = useStyletron();
  return (
    <div className={css({ width: '400px' })}>
      <Banner
        title="Headline text"
        artwork={{
          icon: BannerArtworkIcon,
        }}
      >
        Paragraph text
      </Banner>
      <Banner
        title="Headline text"
        artwork={{
          icon: BannerArtworkIcon,
          type: ARTWORK_TYPE.badge,
        }}
      >
        Paragraph text
      </Banner>
    </div>
  );
}

/* banner/action.tsx */
function BannerActionIcon({ size }: { size: string }) {
  return <Delete size={size} />;
}

function BannerAction() {
  const [css] = useStyletron();
  return (
    <div className={css({ width: '400px' })}>
      <Banner
        action={{
          label: 'Label',
          onClick: () => {},
        }}
        title="Headline text"
      >
        Paragraph text
      </Banner>

      <Banner
        action={{
          label: 'Label',
          icon: BannerActionIcon,
          onClick: () => {},
        }}
        title="Headline text"
      >
        Paragraph text
      </Banner>

      <Banner
        action={{
          label: 'Label',
          onClick: () => {},
          position: ACTION_POSITION.below,
        }}
        title="Headline text"
      >
        Paragraph text
      </Banner>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * SYSTEM BANNER — bw-docs/examples/system-banner/*.tsx (7 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* system-banner/basic.tsx */
function SystemBannerBasic() {
  const [css] = useStyletron();
  return (
    <div className={css({ width: '100%' })}>
      <SystemBanner kind={BANNER_KIND.info}>
        This is an informational system banner
      </SystemBanner>
      <br />
      <SystemBanner kind={BANNER_KIND.positive}>This is a positive system banner</SystemBanner>
      <br />
      <SystemBanner kind={BANNER_KIND.negative}>This is a negative system banner</SystemBanner>
      <br />
      <SystemBanner kind={BANNER_KIND.warning}>This is a warning system banner</SystemBanner>
    </div>
  );
}

/* system-banner/with-actions.tsx */
function SystemBannerWithActions() {
  const [css] = useStyletron();

  return (
    <div className={css({ width: '100%' })}>
      <SystemBanner
        kind={BANNER_KIND.info}
        primaryAction={{
          label: 'Primary Action',
          onClick: () => alert('Primary action clicked'),
        }}
      >
        System banner with primary action
      </SystemBanner>
      <br />
      <SystemBanner
        kind={BANNER_KIND.positive}
        primaryAction={{
          icon: ({ size }) => <ChevronRight size={size} />,
          label: 'Primary Action',
          onClick: () => alert('Primary action clicked'),
        }}
      >
        System banner with primary action and icon
      </SystemBanner>
      <br />
      <SystemBanner
        kind={BANNER_KIND.warning}
        primaryAction={{
          label: 'Primary Action',
          onClick: () => alert('Primary action clicked'),
        }}
        secondaryAction={{
          label: 'Secondary Action',
          onClick: () => alert('Secondary action clicked'),
        }}
      >
        System banner with primary and secondary actions
      </SystemBanner>
    </div>
  );
}

/* system-banner/with-artwork.tsx */
function SystemBannerWithArtwork() {
  const [css] = useStyletron();

  return (
    <div className={css({ width: '100%' })}>
      <SystemBanner kind={BANNER_KIND.info} artworkIcon={({ size }) => <Alert size={size} />}>
        System banner with info icon
      </SystemBanner>
      <br />
      <SystemBanner kind={BANNER_KIND.positive} artworkIcon={({ size }) => <Check size={size} />}>
        System banner with success icon
      </SystemBanner>
      <br />
      <SystemBanner
        kind={BANNER_KIND.negative}
        artworkIcon={({ size }) => <DeleteAlt size={size} />}
        primaryAction={{
          label: 'Take Action',
          onClick: () => alert('Action clicked'),
        }}
      >
        System banner with warning icon and action
      </SystemBanner>
    </div>
  );
}

/* system-banner/with-style-overrides.tsx — ↯ three of Uber's hard-coded values sit outside the
 * theme's reach: the translucent mint glass fill with its matching shadow, the orange-to-red
 * gradient, and the red label on the dismiss button. Each is re-sourced from the theme; the
 * corner steps now read `theme.borders`, and the blur, shadow geometry, padding and pill are
 * Uber's, untouched, because those are what the example is demonstrating. */
function SystemBannerWithStyleOverrides() {
  const [css, theme] = useStyletron();

  return (
    <div
      className={css({
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '24px',
      })}
    >
      {/* Modern minimal style with subtle shadow */}
      <SystemBanner
        kind={BANNER_KIND.info}
        title="Minimal Design"
        overrides={{
          Root: {
            style: {
              borderRadius: theme.borders.radius500,
              boxShadow: '0 4px 14px rgba(0, 0, 0, 0.08)',
              border: 'none',
              padding: '16px',
            },
          },
          LeadingContent: {
            style: {
              paddingLeft: '8px',
            },
          },
          MessageContent: {
            style: {
              padding: '0 16px',
            },
          },
          Title: {
            style: {
              fontWeight: 600,
              fontSize: '18px',
            },
          },
        }}
        artworkIcon={({ size }) => <Alert size={size} />}
      >
        Clean, modern design with subtle shadow and rounded corners
      </SystemBanner>

      {/* Glassmorphism-inspired style */}
      <SystemBanner
        kind={BANNER_KIND.positive}
        title="Glass Effect"
        overrides={{
          Root: {
            style: {
              background: theme.colors.contentPrimary, // ↯ was Uber's translucent mint
              backdropFilter: 'blur(10px)',
              borderRadius: theme.borders.radius400,
              boxShadow: `0 8px 32px ${theme.colors.backgroundInverseSecondary}`, // ↯ was the same mint at low alpha
              border: `1px solid ${theme.colors.borderInverseTransparent}`,
            },
          },
          Title: {
            style: {
              fontSize: '22px',
              fontWeight: 700,
              color: theme.colors.contentInversePrimary, // ↯ was white
            },
          },
          Message: {
            style: {
              color: theme.colors.contentInversePrimary, // ↯ was white
            },
          },
          LeadingContent: {
            style: {
              background: theme.colors.backgroundInverseSecondary,
              padding: '12px',
              borderRadius: '50%',
              marginLeft: '8px',
            },
          },
          TrailingButtonContainer: {
            style: {
              marginRight: '8px',
            },
          },
        }}
        artworkIcon={({ size }) => <Check size={size} color={theme.colors.contentInversePrimary} />}
        primaryAction={{
          label: 'Accept',
          onClick: () => alert('Accepted'),
          icon: ({ size }) => <Check size={size} />,
        }}
      >
        Modern glass-effect styling with vibrant colors and blur
      </SystemBanner>

      {/* Pill-shaped design with gradient */}
      <SystemBanner
        kind={BANNER_KIND.warning}
        overrides={{
          Root: {
            style: {
              borderRadius: '9999px', // theme-gate-allow: the pill shape, like 50% — geometry, identical under any brand
              // ↯ was Uber's orange-to-red gradient
              background: `linear-gradient(135deg, ${theme.colors.contentAccent}, ${theme.colors.contentPrimary})`,
              border: 'none',
              boxShadow: `0 10px 20px ${theme.colors.backgroundInverseSecondary}`,
              padding: '8px 24px',
            },
          },
          LeadingContent: {
            style: {
              backgroundColor: theme.colors.backgroundInverseSecondary,
              borderRadius: '50%',
              padding: '8px',
              marginLeft: '8px',
            },
          },
          Message: {
            style: {
              color: theme.colors.contentInversePrimary, // ↯ was white
              fontWeight: 500,
            },
          },
          TrailingButtonContainer: {
            component: () => (
              <div style={{ marginRight: '8px' }}>
                <Button
                  shape={SHAPE.pill}
                  size={BUTTON_SIZE.compact}
                  overrides={{
                    BaseButton: {
                      style: {
                        backgroundColor: theme.colors.backgroundPrimary,
                        color: theme.colors.contentAccent, // ↯ was the gradient's red
                        ':hover': {
                          backgroundColor: theme.colors.backgroundSecondary,
                        },
                      },
                    },
                  }}
                >
                  Dismiss
                </Button>
              </div>
            ),
          },
        }}
        artworkIcon={({ size }) => (
          <svg
            width={size}
            height={size}
            viewBox="0 0 24 24"
            fill={theme.colors.contentInversePrimary}
          >
            <path d="M12 2C6.48 2 2 6.48 2 12s4.48 10 10 10 10-4.48 10-10S17.52 2 12 2zm1 15h-2v-2h2v2zm0-4h-2V7h2v6z" />
          </svg>
        )}
      >
        Elegant pill-shaped banner with gradient background
      </SystemBanner>
    </div>
  );
}

/* system-banner/clickable-banner.tsx — ↯ the detail panel's own `rgba(0,0,0,0.05)` ground and
 * its blue button are outside the theme; both are re-sourced, and the two corners read
 * `theme.borders`. */
function SystemBannerClickable() {
  const [css, theme] = useStyletron();
  const [showNotification, setShowNotification] = React.useState(false);

  return (
    <div className={css({ width: '100%' })}>
      <SystemBanner
        kind={BANNER_KIND.info}
        artworkIcon={({ size }) => <Alert size={size} />}
        title="New System Update Available"
        primaryAction={{
          label: 'View details',
          onClick: () => setShowNotification(true),
        }}
      >
        Click anywhere on this banner to view update details. The entire banner is clickable when
        only a primary action is provided.
      </SystemBanner>

      {showNotification && (
        <div
          className={css({
            marginTop: '20px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary, // ↯ was rgba(0, 0, 0, 0.05)
            borderRadius: theme.borders.radius300,
          })}
        >
          <h4 className={css({ marginTop: 0 })}>Update Details</h4>
          <p className={css({ marginBottom: 0 })}>
            This notification appears because you clicked the banner. In a real app, this might open
            a modal or navigate to a details page.
          </p>
          <button
            onClick={() => setShowNotification(false)}
            className={css({
              marginTop: '12px',
              padding: '8px 16px',
              border: 'none',
              backgroundColor: theme.colors.contentPrimary, // ↯ was Uber's blue
              color: theme.colors.contentInversePrimary, // ↯ was white
              borderRadius: theme.borders.radius200,
              cursor: 'pointer',
            })}
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}

/* system-banner/multiple-actions.tsx — ↯ the three status panels carry a yellow, a green and a
 * grey wash of their own; all three are re-sourced from the theme. */
function SystemBannerMultipleActions() {
  const [css, theme] = useStyletron();
  const [status, setStatus] = React.useState<string | null>(null);

  const handleUpdate = () => {
    setStatus('updating');
    setTimeout(() => {
      setStatus('updated');
    }, 1500);
  };

  const handleDismiss = () => {
    setStatus('dismissed');
  };

  const renderStatus = () => {
    if (status === 'updating') {
      return (
        <div
          className={css({
            marginTop: '20px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary, // ↯ was Uber's yellow wash
            borderRadius: theme.borders.radius300,
            textAlign: 'center',
          })}
        >
          <p className={css({ margin: 0 })}>Updating system... Please wait.</p>
        </div>
      );
    } else if (status === 'updated') {
      return (
        <div
          className={css({
            marginTop: '20px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary, // ↯ was Uber's green wash
            borderRadius: theme.borders.radius300,
            textAlign: 'center',
            color: theme.colors.contentPositive, // ↯ was Uber's green ink
          })}
        >
          <p className={css({ margin: 0 })}>System successfully updated!</p>
        </div>
      );
    } else if (status === 'dismissed') {
      return (
        <div
          className={css({
            marginTop: '20px',
            padding: '16px',
            backgroundColor: theme.colors.backgroundSecondary, // ↯ was rgba(0, 0, 0, 0.05)
            borderRadius: theme.borders.radius300,
            textAlign: 'center',
          })}
        >
          <p className={css({ margin: 0 })}>Update reminder set for later.</p>
        </div>
      );
    }
    return null;
  };

  return (
    <div className={css({ width: '100%' })}>
      <SystemBanner
        kind={BANNER_KIND.warning}
        artworkIcon={({ size }) => <Alert size={size} />}
        title="Critical Security Update Required"
        primaryAction={{
          label: 'Update now',
          onClick: handleUpdate,
        }}
        secondaryAction={{
          label: 'Remind me later',
          onClick: handleDismiss,
        }}
      >
        This update addresses important security vulnerabilities. When both primary and secondary
        actions are provided, they appear as distinct buttons.
      </SystemBanner>

      {renderStatus()}
    </div>
  );
}

/* system-banner/with-icons.tsx */
function SystemBannerWithIcons() {
  const [css] = useStyletron();

  const viewChanges = () => alert('System changes viewed');

  return (
    <div
      className={css({
        width: '100%',
        display: 'flex',
        flexDirection: 'column',
        gap: '20px',
      })}
    >
      <SystemBanner
        kind={BANNER_KIND.positive}
        artworkIcon={({ size }) => <Check size={size} />}
        title="System Successfully Updated"
        primaryAction={{
          label: 'View changes',
          icon: ({ size }) => <ChevronRight size={size} />,
          onClick: viewChanges,
        }}
      >
        System successfully updated
      </SystemBanner>

      <SystemBanner
        kind={BANNER_KIND.info}
        artworkIcon={({ size }) => <Search size={size} />}
        title="Feature Announcement"
        primaryAction={{
          label: 'Try it now',
          icon: ({ size }) => <Upload size={size} />,
          onClick: () => alert('New feature activated'),
        }}
      >
        Icons can be used for both the leading artwork and trailing action buttons.
      </SystemBanner>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * MESSAGE CARD — bw-docs/examples/message-card/*.tsx (4 examples)
 *
 * The photographs are Uber's own example assets, resolved straight out of bw-docs so the cards
 * run on the images the docs page runs on, and each `ariaLabel` is Uber's own description of the
 * photograph it belongs to.
 *
 * The `colors.*` primitives stay: MessageCard's whole job in this example is to pick a legible
 * text colour against an arbitrary background, so re-inking the backgrounds would delete the
 * demonstration.
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

const valley = new URL('../../../bw-docs/examples/message-card/images/valley.jpg', import.meta.url).href;
const moto = new URL('../../../bw-docs/examples/message-card/images/moto.jpg', import.meta.url).href;
const dinner = new URL('../../../bw-docs/examples/message-card/images/dinner.jpg', import.meta.url).href;
const train = new URL('../../../bw-docs/examples/message-card/images/train.jpg', import.meta.url).href;
const hamburger = new URL('../../../bw-docs/examples/message-card/images/hamburger.jpg', import.meta.url).href;
const venice = new URL('../../../bw-docs/examples/message-card/images/venice.jpg', import.meta.url).href;
const planet = new URL('../../../bw-docs/examples/message-card/images/planet.jpg', import.meta.url).href;

/* message-card/color.tsx */
function MessageCardColor() {
  return (
    <div>
      <MessageCard
        heading="Looking for adventure?"
        paragraph="Pellentesque velit purus, luctus non lorem in, rutrum ultricies quam."
        buttonLabel="Take me there"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: valley,
          ariaLabel: 'A woman hiking through a valley with a yellow backpack',
        }}
        backgroundColor={colors.teal200}
        overrides={{ Root: { style: { marginBottom: '30px' } } }}
      />
      <MessageCard
        heading="Get there fast"
        paragraph="Vivamus lobortis vestibulum bibendum. Duis malesuada ante purus, sit amet auctor felis commodo sed."
        buttonLabel="Go!"
        buttonKind={BUTTON_KIND.tertiary}
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: moto,
          ariaLabel: 'Driving a motorcycle with a delivery container on the back',
        }}
        backgroundColor={colors.purple600}
        overrides={{ Root: { style: { marginBottom: '30px' } } }}
      />
      <MessageCard
        heading="Hidden gems"
        paragraph="Vivamus lobortis vestibulum bibendum. Duis malesuada ante purus, sit amet auctor felis commodo sed."
        buttonLabel="Learn more"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: train,
          ariaLabel: 'A train moving across an arched bridge through a green countryside',
        }}
        backgroundColor={colors.white}
        overrides={{ Root: { style: { marginBottom: '30px' } } }}
      />
      <MessageCard
        heading="Get 20% off your next order"
        paragraph="In tempus lorem ac nisl fringilla gravida."
        buttonLabel="Save now"
        buttonKind={BUTTON_KIND.tertiary}
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: dinner,
          ariaLabel: 'A table with freshly prepared food',
        }}
        backgroundColor={colors.brown500}
      />
    </div>
  );
}

/* message-card/custom-color.tsx — the arbitrary hex IS the demonstration: MessageCard is handed
 * a colour from outside any palette, told the ground is dark, and picks legible text against it.
 * Re-inking it from the theme would delete the example. */
function MessageCardCustomColor() {
  return (
    <MessageCard
      heading="Your favorites, fast"
      paragraph="Quisque sodales tempor metus."
      buttonLabel="Order"
      onClick={() => alert('Clicked 🙂')}
      image={{
        src: hamburger,
        layout: IMAGE_LAYOUT.trailing,
        ariaLabel: 'A deconstructed hamburger being literally thrown together',
      }}
      backgroundColor="#101010" // theme-gate-allow: the arbitrary out-of-palette ground this example exists to demonstrate
      backgroundColorType={BACKGROUND_COLOR_TYPE.dark}
    />
  );
}

/* message-card/layout.tsx */
function MessageCardLayout() {
  return (
    <div>
      <MessageCard
        heading="Looking for adventure?"
        paragraph="Nam vitae maximus nibh."
        buttonLabel="Take me there"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: venice,
          layout: IMAGE_LAYOUT.trailing,
          ariaLabel: 'Cruising down a Venetian canal in a gondola',
        }}
        backgroundColor={colors.purple300}
        overrides={{ Root: { style: { marginBottom: '30px' } } }}
      />
      <MessageCard
        heading="Looking for adventure?"
        paragraph="Nam vitae maximus nibh, ac hendrerit lectus."
        buttonLabel="Learn more"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: planet,
          layout: IMAGE_LAYOUT.trailing,
          ariaLabel: 'A surreal digitally illustrated planet',
        }}
      />
    </div>
  );
}

/* message-card/positioning.tsx — the copy repeats on purpose: four cards, one sentence, so the
 * only thing that varies is where the photograph sits inside its frame. */
function MessageCardPositioning() {
  return (
    <div>
      <MessageCard
        paragraph="Pellentesque velit purus, luctus non lorem in, rutrum ultricies quam."
        buttonLabel="Explore"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: valley,
          backgroundPosition: '50% 65%',
          ariaLabel: 'A woman hiking through a valley with a yellow backpack',
        }}
        backgroundColor={colors.teal200}
        overrides={{ Root: { style: { marginBottom: '30px' } } }}
      />
      <MessageCard
        paragraph="Pellentesque velit purus, luctus non lorem in, rutrum ultricies quam."
        buttonLabel="Explore"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: valley,
          backgroundPosition: 'bottom',
          ariaLabel: 'A woman hiking through a valley with a yellow backpack',
        }}
        backgroundColor={colors.teal200}
        overrides={{ Root: { style: { marginBottom: '30px' } } }}
      />
      <MessageCard
        heading="Fast, fresh, delicious"
        paragraph="Nam vitae maximus nibh, ac hendrerit lectus."
        buttonLabel="Order now"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: dinner,
          backgroundPosition: 'left center',
          layout: IMAGE_LAYOUT.trailing,
          ariaLabel: 'A table with freshly prepared food',
        }}
        overrides={{ Root: { style: { marginBottom: '30px' } } }}
      />
      <MessageCard
        heading="Fast, fresh, delicious"
        paragraph="Nam vitae maximus nibh, ac hendrerit lectus."
        buttonLabel="Order now"
        onClick={() => alert('Clicked 🙂')}
        image={{
          src: dinner,
          backgroundPosition: 'center right',
          layout: IMAGE_LAYOUT.trailing,
          ariaLabel: 'A table with freshly prepared food',
        }}
      />
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * EMPTY STATE — bw-docs/examples/empty-state/*.tsx (2 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* empty-state/empty-state.tsx */
function EmptyStateExample() {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <Hide size={theme.sizing.scale1600} />
      <div
        className={css({
          ...theme.typography.HeadingXSmall,
          paddingBlockStart: theme.sizing.scale650,
          paddingBlockEnd: theme.sizing.scale500,
        })}
      >
        All caught up
      </div>
      <div
        className={css({
          ...theme.typography.ParagraphMedium,
          paddingBlockEnd: theme.sizing.scale650,
        })}
      >
        Check back for new messages.
      </div>
      <Button
        onClick={() => {}}
        kind={BUTTON_KIND_BASE.secondary}
        shape={SHAPE.pill}
        size={BUTTON_SIZE.compact}
      >
        Go back
      </Button>
    </div>
  );
}

/* empty-state/loading.tsx */
function EmptyStateLoading() {
  const [css, theme] = useStyletron();
  return (
    <div
      className={css({
        alignItems: 'center',
        display: 'flex',
        flexDirection: 'column',
      })}
    >
      <Spinner $borderWidth={theme.sizing.scale100} $size={theme.sizing.scale1600} />
      <div
        className={css({
          ...theme.typography.HeadingXSmall,
          paddingBlockStart: theme.sizing.scale650,
          paddingBlockEnd: theme.sizing.scale500,
        })}
      >
        Loading...
      </div>
    </div>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * HINT DOT — bw-docs/examples/hint-dot/*.tsx (1 example)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* hint-dot/offset.tsx */
function HintDotOffset() {
  return (
    <React.Fragment>
      <HintDot color={BADGE_COLOR.negative} horizontalOffset="2px" verticalOffset="2px">
        <Tag closeable={false} size={TAG_SIZE.medium}>
          Ipsum
        </Tag>
      </HintDot>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * NOTIFICATION CIRCLE — bw-docs/examples/notification-circle/*.tsx (2 examples)
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

/* notification-circle/inline.tsx */
function NotificationCircleInline() {
  return (
    <React.Fragment>
      Inbox <NotificationCircle color={BADGE_COLOR.positive} content={14} />
    </React.Fragment>
  );
}

/* notification-circle/offset.tsx */
function NotificationCircleOffset() {
  return (
    <React.Fragment>
      <NotificationCircle
        content={11}
        color={BADGE_COLOR.positive}
        placement={BADGE_PLACEMENT.topRight}
        horizontalOffset="0px"
        verticalOffset="0px"
      >
        <Tag size={TAG_SIZE.large} closeable={false}>
          Ipsum Lorem
        </Tag>
      </NotificationCircle>
    </React.Fragment>
  );
}

/* ═══════════════════════════════════════════════════════════════════════════════════════════
 * THE PAGE
 * ═══════════════════════════════════════════════════════════════════════════════════════════ */

export default function FeedbackSection() {
  return (
    <>
      <Section
        t="Spinner"
        n="Show that an action is processing and its result is still on the way."
      >
        <Grid>
          <Tile name="Basic" span={4}>
            <SpinnerBasic />
          </Tile>
          <Tile
            name="Sizes"
            rule="$size takes small, medium (the default) or large — or any sizing step."
            span={4}
          >
            <SpinnerSizes />
          </Tile>
          <Tile
            name="Element"
            rule="$as changes the underlying element, so a spinner can sit inside a p."
            span={4}
          >
            <SpinnerSpan />
          </Tile>
          <Tile
            name="Customizing"
            rule="withStyle resizes the box and repaints the highlight. ↯ Uber's pink is re-sourced from the theme."
            span={4}
          >
            <SpinnerCustom />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Skeleton"
        n="Hold the shape of content that is still loading, with or without animation."
      >
        <Grid>
          <Tile name="Basic usage" rule="height and width give a single rectangle." span={4}>
            <SkeletonBasic />
          </Tile>
          <Tile
            name="AutoSize Rows"
            rule="autoSizeRows makes the rows grow to fill the container."
            span={4}
          >
            <SkeletonAutoSizeRows />
          </Tile>
          <Tile
            name="Other Shapes"
            rule="overrides.Root changes the shape and the position."
            span={4}
          >
            <SkeletonCircle />
          </Tile>
          <Tile name="Animation" span={4}>
            <SkeletonAnimation />
          </Tile>
          <Tile
            name="Sub elements"
            rule="rows above zero turns the Root transparent and draws that many rows; overrides.Row shapes them."
            span={4}
          >
            <SkeletonSubElements />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Progress Bar"
        n="Show how far along a wait is, inside a flow or while data loads."
      >
        <Grid>
          <Tile name="Progress bar Basic Usage" span={6}>
            <ProgressBarBasic />
          </Tile>
          <Tile
            name="Progress bar with Negative Color"
            rule="colors.negative collapses onto ink in this theme, so the bar reads as the ordinary bar."
            span={6}
          >
            <ProgressBarNegative />
          </Tile>
          <Tile
            name="Progress bar with Intent"
            rule="Five intents; four resolve to ink and brand resolves to saffron. VERSION SHIM — see the file header."
            span={6}
          >
            <ProgressBarIntent />
          </Tile>
          <Tile name="Progress bar with Visible Label" span={6}>
            <ProgressBarWithLabel />
          </Tile>
          <Tile
            name="Progress bar with Custom Label"
            rule="getProgressLabel writes the label from the value."
            span={6}
          >
            <ProgressBarCustomLabel />
          </Tile>
          <Tile
            name="Progress bar with Overrides"
            rule="A thicker bar with the percentage drawn inside it, via a :after on BarProgress."
            span={6}
          >
            <ProgressBarOverrides />
          </Tile>
          <Tile
            name="Steps"
            rule="steps sections the bar when the action has a countable number of stages."
            span={6}
          >
            <ProgressBarSteps />
          </Tile>
          <Tile
            name="Basic Usage"
            rule="ProgressBarRounded — the rounded version; progress is a number between 0 and 1."
            span={6}
          >
            <ProgressBarRoundedBasic />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Progress Steps"
        n="Show staged progress through an action, so people see where they are and what is left."
      >
        <Grid>
          <Tile name="Progress Steps Dotted Usage" span={6}>
            <ProgressStepsDotted />
          </Tile>
          <Tile name="Progress Steps Numbered Usage" span={6}>
            <ProgressStepsNumbered />
          </Tile>
          <Tile name="Progress Steps Horizontal Usage" span={12}>
            <ProgressStepsHorizontal />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Snackbar"
        n="Acknowledge an action that just happened; it times out on its own so work carries on."
      >
        <Grid>
          <Tile
            name="Line lengths"
            rule="Three lines is the ceiling; longer durations give the reader time to reach the end."
            span={6}
          >
            <SnackbarLineLengths />
          </Tile>
          <Tile
            name="Infinite duration"
            rule="DURATION.infinite waits for the task; progress draws the spinner; dequeue closes it."
            span={6}
          >
            <SnackbarInfiniteDuration />
          </Tile>
          <Tile
            name="Placement"
            rule="Placement is set on the SnackbarProvider, so one app keeps one position."
            span={6}
          >
            <SnackbarPlacement />
          </Tile>
          <Tile
            name="Action button usage"
            rule="One action, and it undoes, retries, cancels or links onward."
            span={6}
          >
            <SnackbarActionButtonUsage />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Toast"
        n="Float a dismissible message over the view; it self-dismisses after a short time."
      >
        <Grid>
          <Tile
            name="Toast Notification Basic Usage"
            rule="Four kinds; all four come out ink here, which is the theme working."
            span={6}
          >
            <ToastNotification />
          </Tile>
          <Tile
            name="Toaster Using Key To Update Open Toasts"
            rule="Reusing a key updates the open toast instead of stacking a new one."
            span={6}
          >
            <ToastSameKeyNotification />
          </Tile>
          <Tile
            name="Toast Being Closed From Outside"
            rule="Hold the key that toaster.info returns and toaster.clear closes it from anywhere."
            span={6}
          >
            <ToastCloseFromOutside />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Notification"
        n="Put important information inline with the content, where it stays until it is read or closed."
      >
        <Grid>
          <Tile name="Notification Basic Usage" span={6}>
            <NotificationBasic />
          </Tile>
          <Tile name="Notification with all Available Kinds" span={6}>
            <NotificationKinds />
          </Tile>
          <Tile name="Notification Closeable example" rule="closeable adds the X." span={6}>
            <NotificationCloseable />
          </Tile>
          <Tile
            name="Notification in Full width"
            rule="width: auto on Body lets it take the width it is given."
            span={6}
          >
            <NotificationFullWidth />
          </Tile>
          <Tile
            name="Notification with Overrides"
            rule="border600 on Body and a different close icon."
            span={6}
          >
            <NotificationOverrides />
          </Tile>
          <Tile
            name="Notification with Custom Dismiss"
            rule="Children as a function hand you dismiss, so anything can close it."
            span={6}
          >
            <NotificationCustomDismiss />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Banner"
        n="Carry a contextual message for one page or feature, inline with the content."
      >
        <Grid>
          <Tile
            name="Color schemes"
            rule="Low contrast for the lighter message, high for the heavier one — eight pairs, one sentence."
            span={6}
          >
            <BannerVariants />
          </Tile>
          <Tile name="Artwork" rule="An icon, or the same icon inside a badge." span={6}>
            <BannerArtwork />
          </Tile>
          <Tile
            name="Action"
            rule="Trailing by default; ACTION_POSITION.below moves it under the text."
            span={6}
          >
            <BannerAction />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="System Banner"
        n="Announce a system-wide state at the top of a page, always at high contrast."
      >
        <Grid>
          <Tile name="Basic usage" span={12}>
            <SystemBannerBasic />
          </Tile>
          <Tile
            name="With actions"
            rule="primaryAction and secondaryAction take a label, an onClick and an optional icon."
            span={12}
          >
            <SystemBannerWithActions />
          </Tile>
          <Tile name="With custom artwork" rule="artworkIcon replaces Banner's artwork object." span={12}>
            <SystemBannerWithArtwork />
          </Tile>
          <Tile
            name="With style overrides"
            rule="Uber's three treatments, kept whole. ↯ every hard-coded hue is re-sourced from the theme."
            span={12}
          >
            <SystemBannerWithStyleOverrides />
          </Tile>
          <Tile
            name="Clickable banner"
            rule="With only a primaryAction, the whole banner is the button."
            span={12}
          >
            <SystemBannerClickable />
          </Tile>
          <Tile
            name="Multiple actions"
            rule="With both actions, they render as two distinct buttons."
            span={12}
          >
            <SystemBannerMultipleActions />
          </Tile>
          <Tile name="With icons" rule="Icons on the artwork and on the action button." span={12}>
            <SystemBannerWithIcons />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="Message Card"
        n="Preview a message with an image and a call to action, to invite a tap for the detail."
      >
        <Grid>
          <Tile
            name="Color"
            rule="MessageCard picks the legible text colour from the background it is given."
            span={6}
          >
            <MessageCardColor />
          </Tile>
          <Tile
            name="Custom color"
            rule="Outside the primitive palette, backgroundColorType tells it whether the colour is light or dark."
            span={6}
          >
            <MessageCardCustomColor />
          </Tile>
          <Tile
            name="Layout"
            rule="Image on top, or trailing at a fixed 112 wide."
            span={6}
          >
            <MessageCardLayout />
          </Tile>
          <Tile
            name="Adjusting the image position"
            rule="backgroundPosition moves the photograph inside its frame."
            span={6}
          >
            <MessageCardPositioning />
          </Tile>
        </Grid>
      </Section>

      <Section t="Empty State" n="Say what belongs here while there is nothing to show yet.">
        <Grid>
          <Tile name="Empty state" span={6}>
            <EmptyStateExample />
          </Tile>
          <Tile name="Loading" span={6}>
            <EmptyStateLoading />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="HintDot"
        n="Point out something new, at the trailing end of the icon, component or text it belongs to."
      >
        <Grid>
          <Tile
            name="Offset"
            rule="horizontalOffset and verticalOffset place it by hand when the standard placements miss."
            span={4}
          >
            <HintDotOffset />
          </Tile>
        </Grid>
      </Section>

      <Section
        t="NotificationCircle"
        n="Carry a count on the thing it belongs to; past nine it reads 9+."
      >
        <Grid>
          <Tile name="Inline notification circle" rule="Inline, keep it to numbers." span={4}>
            <NotificationCircleInline />
          </Tile>
          <Tile
            name="Offset"
            rule="horizontalOffset sets right (or left on a topLeft placement); verticalOffset sets top."
            span={4}
          >
            <NotificationCircleOffset />
          </Tile>
        </Grid>
      </Section>
    </>
  );
}
